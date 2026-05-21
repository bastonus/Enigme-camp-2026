#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OVH Repository Creator Automated - Version 3.0
Unifié, Sécurisé et sans extensions d'éditeur.
"""

import os
import sys
import subprocess
import shutil
import json
import time
import getpass
import logging
import random
import string
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List


# Auto-installation de la bibliothèque paramiko si absente
try:
    import paramiko
except ImportError:
    print("La bibliothèque 'paramiko' est requise mais manquante.")
    print("Tentative d'installation automatique via pip...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
        import paramiko
        print("[OK] La bibliothèque 'paramiko' a été installée avec succès !")
    except Exception as e:
        print(f"[ERREUR] Impossible d'installer 'paramiko' automatiquement : {e}")
        print("Veuillez installer paramiko manuellement avec la commande : pip install paramiko")
        sys.exit(1)

class SSHOperationError(Exception):
    """Exception levée pour les erreurs d'opération SSH"""
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code

class SSHClient:
    """Client SSH sécurisé pour OVH Repository Creator"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.client: Optional[paramiko.SSHClient] = None
        self.connected = False
    
    def connect(self, hostname: str, username: str, port: int = 22, password: str = None, key_file: str = None) -> bool:
        """Établit une connexion SSH sécurisée"""
        try:
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if key_file:
                expanded_key_path = os.path.abspath(key_file)
                self.logger.info(f"Tentative de connexion par clé avec: {expanded_key_path}")
                self.client.connect(
                    hostname=hostname,
                    username=username,
                    port=port,
                    key_filename=expanded_key_path,
                    timeout=15
                )
            elif password:
                self.logger.info(f"Tentative de connexion par mot de passe pour {username}@{hostname}")
                self.client.connect(
                    hostname=hostname,
                    username=username,
                    port=port,
                    password=password,
                    timeout=15
                )
            else:
                self.client.connect(
                    hostname=hostname,
                    username=username,
                    port=port,
                    timeout=15
                )
            
            self.connected = True
            self.logger.info(f"Connexion SSH établie: {username}@{hostname}:{port}")
            return True
            
        except Exception as e:
            self.logger.error(f"Erreur de connexion SSH: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Ferme la connexion SSH"""
        try:
            if self.client and self.connected:
                self.client.close()
                self.connected = False
                self.logger.info("Connexion SSH fermée")
        except Exception as e:
            self.logger.error(f"Erreur lors de la fermeture SSH: {e}")
    
    def is_connected(self) -> bool:
        """Vérifie si la connexion est active"""
        return self.connected and self.client is not None
    
    def execute_command(self, command: str) -> Tuple[int, str, str]:
        """Exécute une commande SSH"""
        if not self.is_connected():
            raise SSHOperationError("Connexion SSH non établie", "NOT_CONNECTED")
        
        try:
            stdin, stdout, stderr = self.client.exec_command(command)
            exit_status = stdout.channel.recv_exit_status()
            
            stdout_content = stdout.read().decode('utf-8', errors='replace')
            stderr_content = stderr.read().decode('utf-8', errors='replace')
            
            return exit_status, stdout_content, stderr_content
            
        except Exception as e:
            raise SSHOperationError(f"Erreur d'exécution SSH: {e}", "EXECUTION_FAILED")
    
    def generate_local_key_pair(self, key_path: str = ".ssh/id_prod") -> bool:
        """Génère une clé SSH ed25519 dédiée localement et configure .gitignore"""
        try:
            key_dir = os.path.dirname(key_path)
            if key_dir and not os.path.exists(key_dir):
                os.makedirs(key_dir, exist_ok=True)
                self.logger.info(f"Dossier {key_dir} créé.")
            
            # Générer la clé SSH ed25519
            if not os.path.exists(key_path):
                cmd = ['ssh-keygen', '-t', 'ed25519', '-f', key_path, '-N', '', '-q']
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    # Tenter RSA en repli au cas où ed25519 n'est pas supporté (vieux systèmes)
                    cmd_rsa = ['ssh-keygen', '-t', 'rsa', '-b', '4096', '-f', key_path, '-N', '', '-q']
                    result_rsa = subprocess.run(cmd_rsa, capture_output=True, text=True)
                    if result_rsa.returncode != 0:
                        raise SSHOperationError(f"Échec de la génération des clés SSH: {result_rsa.stderr}", "KEYGEN_FAILED")
                self.logger.info(f"Clé SSH dédiée générée dans {key_path}")
            else:
                self.logger.info(f"La clé SSH dédiée {key_path} existe déjà.")

            # Sécurisation des accès (Ignorer dans Git)
            gitignore_path = ".gitignore"
            ignored = False
            if os.path.exists(gitignore_path):
                with open(gitignore_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if ".ssh/" in content or (key_dir and f"{key_dir}/" in content):
                    ignored = True
            
            if not ignored:
                with open(gitignore_path, 'a', encoding='utf-8') as f:
                    f.write("\n.ssh/\n")
                self.logger.info("Dossier .ssh/ ajouté au .gitignore")
            
            return True
        except Exception as e:
            self.logger.error(f"Erreur lors de la génération de la clé locale: {e}")
            return False

    def upload_public_key(self, key_path: str = ".ssh/id_prod") -> bool:
        """Transfère la clé publique vers le serveur distant dans authorized_keys"""
        try:
            pub_key_path = f"{key_path}.pub"
            if not os.path.exists(pub_key_path):
                self.logger.error(f"Clé publique introuvable: {pub_key_path}")
                return False
                
            with open(pub_key_path, 'r', encoding='utf-8') as f:
                pub_key = f.read().strip()
            
            # Créer le répertoire .ssh sur le serveur si nécessaire et ajouter la clé
            cmd_check_ssh = "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
            exit_status, stdout, stderr = self.execute_command(cmd_check_ssh)
            if exit_status != 0:
                self.logger.error(f"Impossible de créer ~/.ssh sur le serveur: {stderr}")
                return False
            
            # Ajouter la clé si non présente
            exit_status, stdout, stderr = self.execute_command("cat ~/.ssh/authorized_keys 2>/dev/null || echo ''")
            existing_keys = stdout.strip()
            
            if pub_key not in existing_keys:
                cmd_add = f"echo '{pub_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
                exit_status, stdout, stderr = self.execute_command(cmd_add)
                if exit_status != 0:
                    self.logger.error(f"Impossible d'ajouter la clé publique dans authorized_keys: {stderr}")
                    return False
                self.logger.info("Clé publique ajoutée avec succès au serveur distant.")
            else:
                self.logger.info("La clé publique existe déjà sur le serveur distant.")
                
            return True
        except Exception as e:
            self.logger.error(f"Erreur lors du transfert de la clé publique: {e}")
            return False

    def configure_remote_git_deployment(self, web_dir: str, bare_repo: str) -> bool:
        """Configure le dépôt bare distant et le hook de déploiement post-receive"""
        try:
            if not self.is_connected():
                self.logger.error("Connexion SSH non établie pour la configuration distante.")
                return False
            
            # Escape paths for bash double quotes
            esc_web_dir = web_dir.replace('"', '\\"')
            esc_bare_repo = bare_repo.replace('"', '\\"')
            
            remote_commands = f"""set -e
mkdir -p "{esc_web_dir}"
mkdir -p "{esc_bare_repo}"
cd "{esc_bare_repo}"
if [ ! -d "hooks" ]; then
    git init --bare
fi
cat > hooks/post-receive << 'HOOK_EOF'
#!/bin/bash
# Déploiement automatique vers la production en ignorant le .gitignore
GIT_WORK_TREE="{esc_web_dir}" git checkout -f
HOOK_EOF
chmod +x hooks/post-receive
"""
            exit_status, stdout, stderr = self.execute_command(remote_commands)
            if exit_status != 0:
                self.logger.error(f"Échec de la configuration distante: {stderr}")
                return False
                
            self.logger.info("Serveur distant configuré avec succès (dépôt bare et hook installés).")
            return True
        except Exception as e:
            self.logger.error(f"Erreur lors de la configuration distante: {e}")
            return False

    def configure_local_git_repository(self, hostname: str, username: str, bare_repo: str, key_path: str = ".ssh/id_prod", remote_name: str = "production") -> bool:
        """Configure localement Git pour utiliser la clé SSH dédiée et ajoute le remote spécifié"""
        try:
            # 1. S'assurer que le dépôt git local est initialisé
            if not os.path.exists(".git"):
                result = subprocess.run(['git', 'init'], capture_output=True, text=True)
                if result.returncode != 0:
                    self.logger.error(f"Échec de l'initialisation de Git local: {result.stderr}")
                    return False
                self.logger.info("Dépôt Git local initialisé.")
            
            # 2. Configurer remote.<remote_name>.sshCommand (chemin absolu)
            # Utilisation du chemin absolu sur Windows pour assurer le fonctionnement depuis n'importe quel sous-dossier
            abs_key_path = os.path.abspath(key_path).replace('\\', '/')
            ssh_command = f'ssh -i "{abs_key_path}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no'
            
            result = subprocess.run(['git', 'config', f'remote.{remote_name}.sshCommand', ssh_command], capture_output=True, text=True)
            if result.returncode != 0:
                self.logger.error(f"Échec de l'application de remote.{remote_name}.sshCommand: {result.stderr}")
                return False
            self.logger.info(f"Configuration remote.{remote_name}.sshCommand appliquée avec succès.")
            
            # 3. Configurer le remote local
            subprocess.run(['git', 'remote', 'remove', remote_name], capture_output=True)
            
            remote_url = f"{username}@{hostname}:{bare_repo}"
            result = subprocess.run(['git', 'remote', 'add', remote_name, remote_url], capture_output=True, text=True)
            if result.returncode != 0:
                self.logger.error(f"Échec de l'ajout du remote '{remote_name}': {result.stderr}")
                return False
                
            self.logger.info(f"Remote '{remote_name}' ({remote_url}) ajouté avec succès.")
            return True
        except Exception as e:
            self.logger.error(f"Erreur lors de la configuration Git locale: {e}")
            return False

class Colors:
    """Couleurs pour l'affichage console"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    # Couleurs de fond
    BG_BLUE = '\033[44m'
    BG_GREEN = '\033[42m'
    BG_YELLOW = '\033[43m'
    BG_RED = '\033[41m'

class ProgressBar:
    """Barre de progression visuelle"""
    def __init__(self, total: int = 100, width: int = 40):
        self.total = total
        self.width = width
        self.current = 0
    
    def update(self, value: int):
        self.current = min(value, self.total)
        percent = (self.current / self.total) * 100
        filled = int((self.current / self.total) * self.width)
        bar = '█' * filled + '░' * (self.width - filled)
        return f"[{bar}] {percent:.1f}%"

class OVHRepoCreator:
    """Créateur de dépôt et configurateur de déploiement Git OVH interactif"""
    
    def __init__(self):
        self.config: Dict[str, Any] = {}
        self.config_file = os.path.join(os.getcwd(), 'ovh_config.json')
        self.setup_logging()
        self.load_config()
        self.current_step = 0
        self.total_steps = 7
        self.steps = ['CONFIG', 'CLE_GEN', 'CONNEXION', 'CLE_PUSH', 'DISTANT', 'GIT_LOCAL', 'FIN']
        self.ssh_client = SSHClient(self.logger)
        
    def setup_logging(self):
        """Configure le système de log dans un fichier local"""
        log_dir = os.path.join(os.getcwd(), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, 'ovh_deploy.log')
        
        self.logger = logging.getLogger("OVHDeploy")
        self.logger.setLevel(logging.INFO)
        self.logger.handlers.clear()
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        self.logger.addHandler(file_handler)
        self.logger.propagate = False
        
        self.logger.info("🚀 Démarrage du script unifié OVH Repository Creator")
        
    def load_config(self):
        """Charge la configuration depuis le fichier json et gère la compatibilité descendante"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    old_config = json.load(f)
                
                # Conversion des anciens formats
                self.config = {}
                
                # Hostname / Server
                if 'hostname' in old_config:
                    self.config['hostname'] = old_config['hostname']
                elif 'ssh' in old_config and isinstance(old_config['ssh'], dict) and 'server' in old_config['ssh']:
                    self.config['hostname'] = old_config['ssh']['server']
                else:
                    self.config['hostname'] = 'ssh.cluster100.hosting.ovh.net'
                    
                # Port
                if 'port' in old_config:
                    self.config['port'] = int(old_config['port'])
                elif 'ssh' in old_config and isinstance(old_config['ssh'], dict) and 'port' in old_config['ssh']:
                    self.config['port'] = int(old_config['ssh']['port'])
                else:
                    self.config['port'] = 22
                    
                # Username
                if 'username' in old_config:
                    self.config['username'] = old_config['username']
                elif 'ssh' in old_config and isinstance(old_config['ssh'], dict) and 'username' in old_config['ssh']:
                    self.config['username'] = old_config['ssh']['username']
                else:
                    self.config['username'] = ''
                    
                # Local project dir
                self.config['local_project_dir'] = old_config.get('local_project_dir', os.getcwd())
                
                # Remote web directory
                if 'web_dir' in old_config:
                    self.config['web_dir'] = old_config['web_dir']
                elif 'remote_folder' in old_config:
                    self.config['web_dir'] = old_config['remote_folder']
                else:
                    self.config['web_dir'] = ''
                    
                # Remote bare repository
                if 'bare_repo' in old_config:
                    self.config['bare_repo'] = old_config['bare_repo']
                elif 'remote_git_repo' in old_config:
                    self.config['bare_repo'] = old_config['remote_git_repo']
                else:
                    self.config['bare_repo'] = ''
                    
                self.logger.info("Configuration chargée et convertie avec succès.")
            else:
                self.config = {}
        except Exception as e:
            self.logger.error(f"Erreur lors du chargement de la configuration: {e}")
            self.config = {}
            
    def save_config(self):
        """Sauvegarde la configuration actuelle dans le fichier json"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
            self.logger.info("Configuration sauvegardée avec succès.")
            return True
        except Exception as e:
            self.logger.error(f"Erreur lors de la sauvegarde de la configuration: {e}")
            return False

    def log_operation(self, operation: str, success: bool, details: str = ""):
        """Enregistre le statut d'une opération dans le fichier log"""
        status = "SUCCESS" if success else "FAILED"
        message = f"[{status}] {operation}"
        if details:
            message += f" - {details}"
        if success:
            self.logger.info(message)
        else:
            self.logger.error(message)

    def clear_screen(self):
        """Nettoie la console"""
        os.system('cls' if os.name == 'nt' else 'clear')

    def print_header(self):
        """Affiche l'entête graphique du script"""
        print(f"{Colors.HEADER}{Colors.BOLD}")
        print("╔══════════════════════════════════════════════════════════════════════════════╗")
        print("║                    🚀 OVH REPOSITORY CREATOR AUTOMATED 🚀                   ║")
        print("║                         Version 3.0 - Sans Extensions                        ║") 
        print("║                                                                              ║")
        print("║             CONSEIL: Saisissez 'quit', 'exit' ou 'q' pour quitter            ║")
        print("║                    Ou utilisez Ctrl+C pour interrompre le script             ║")
        print("╚══════════════════════════════════════════════════════════════════════════════╝")
        print(f"{Colors.ENDC}")

    def print_progress_bar(self):
        """Affiche la barre de progression linéaire des étapes"""
        print(f"{Colors.OKBLUE}")
        
        steps_row = "│  📋 ÉTAPES  │"
        for i, step in enumerate(self.steps, 1):
            if i < self.current_step:
                steps_row += f" {step} │"
            elif i == self.current_step:
                steps_row += f" {Colors.BG_BLUE}{Colors.BOLD} {step} {Colors.ENDC}{Colors.OKBLUE} │"
            else:
                steps_row += f" {step} │"
                
        border_width = 79
        print("┌" + "─" * border_width + "┐")
        print(steps_row)
        print("└" + "─" * border_width + "┘")
        print(f"{Colors.ENDC}", end="")

    def print_step_header(self, step_num: int, title: str):
        """Affiche l'entête textuelle d'une étape spécifique"""
        print(f"\n{Colors.OKCYAN}{Colors.BOLD}")
        step_content = f"{title}\n{'═' * 79}"
        for line in step_content.split('\n'):
            wrapped_lines = self.wrap_text(line, 80)
            for wrapped_line in wrapped_lines:
                print(wrapped_line)
        print(f"{Colors.ENDC}")

    def wrap_text(self, text: str, max_width: int = 75) -> List[str]:
        """Découpe proprement le texte pour s'adapter à la largeur maximale de la boîte"""
        lines = []
        for line in text.split('\n'):
            if not line.strip():
                lines.append("")
                continue
            
            stripped_line = line.lstrip()
            indent = line[:len(line) - len(stripped_line)]
            
            special_prefix = ""
            if stripped_line.startswith(('└─', '├─', '│', '┌', '┐', '┘', '└', '║', '╔', '╗', '╚', '╝', '═', '─')):
                i = 0
                while i < len(stripped_line) and stripped_line[i] in '└─├│┌┐┘└║╔╗╚╝═':
                    i += 1
                special_prefix = stripped_line[:i]
                remaining_text = stripped_line[i:].strip()
            else:
                remaining_text = stripped_line
            
            if len(line) <= max_width:
                lines.append(line)
                continue
            
            words = remaining_text.split()
            current_line = indent + special_prefix
            if special_prefix and remaining_text:
                if words:
                    current_line += " " + words[0]
                    words = words[1:]
            elif remaining_text and words:
                current_line = words[0]
                words = words[1:]
            
            for word in words:
                test_line = current_line + " " + word
                if len(test_line) <= max_width:
                    current_line = test_line
                else:
                    lines.append(current_line)
                    current_line = indent + special_prefix + (" " if special_prefix else "") + word
            
            if current_line.strip():
                lines.append(current_line)
        return lines

    def print_box(self, title: str, content: str, color: str = Colors.OKBLUE, max_width: int = 75):
        """Dessine une boîte textuelle stylisée avec titre et contenu"""
        wrapped_lines = []
        for line in content.split('\n'):
            if line.strip():
                wrapped_lines.extend(self.wrap_text(line, max_width))
            else:
                wrapped_lines.append("")
        
        box_width = max_width + 4
        print(color)
        print(f"┌─ {title} {'─' * (box_width - len(title) - 3)}┐")
        for line in wrapped_lines:
            if len(line) > box_width - 2:
                line = line[:box_width - 2]
            padded_line = line.ljust(box_width - 2)
            print(f"│ {padded_line} │")
        print(f"└{'─' * box_width}┘")
        print(Colors.ENDC)

    def print_fixed_box(self, content: str, color: str = Colors.OKBLUE):
        """Affiche un texte encadré déjà formaté sans modification de largeur"""
        print(color)
        for line in content.split('\n'):
            print(line)
        print(Colors.ENDC)

    def animate_loading(self, message: str, duration: int = 3):
        """Affiche un indicateur de chargement animé dans la console"""
        chars = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
        for i in range(duration * 10):
            print(f"\r{message} {chars[i % len(chars)]}", end="", flush=True)
            time.sleep(0.1)
        print(f"\r{message} ✅")

    def check_exit_command(self, user_input: str) -> bool:
        """Vérifie si l'utilisateur souhaite quitter le script"""
        exit_commands = ['quit', 'exit', 'q', 'stop', 'cancel']
        return user_input.lower().strip() in exit_commands

    def get_user_input(self, prompt: str, default: str = "", required: bool = True) -> str:
        """Invite l'utilisateur à saisir une valeur avec option de valeur par défaut"""
        if default:
            full_prompt = f"{prompt} [{default}] : "
        else:
            full_prompt = f"{prompt} : "
        
        while True:
            value = input(full_prompt).strip()
            
            if self.check_exit_command(value):
                self.log_operation("User exit", True, f"Exit command: {value}")
                print(f"\n{Colors.WARNING}👋 Arrêt du script demandé par l'utilisateur.{Colors.ENDC}")
                return "EXIT"
            
            if value or default:
                return value or default
            if not required:
                return ""
            print(f"{Colors.FAIL}❌ Cette valeur est obligatoire !{Colors.ENDC}")

    def get_yes_no_input(self, prompt: str) -> str:
        """Invite l'utilisateur à répondre par Oui ou par Non"""
        while True:
            full_prompt = f"{prompt} (y/n) : "
            valid_responses = ['y', 'yes', 'n', 'no']
            
            value = input(full_prompt).strip().lower()
            
            if self.check_exit_command(value):
                self.log_operation("User exit", True, f"Exit command: {value}")
                print(f"\n{Colors.WARNING}👋 Arrêt du script demandé par l'utilisateur.{Colors.ENDC}")
                return "EXIT"
            
            if value in valid_responses:
                return value
            else:
                print(f"{Colors.FAIL}❌ Option invalide ! Veuillez répondre par 'y' (oui) ou 'n' (non).{Colors.ENDC}")

    def get_password_input(self, prompt: str) -> str:
        """Invite l'utilisateur à saisir un mot de passe de façon masquée"""
        while True:
            password = getpass.getpass(f"{prompt} : ")
            
            if self.check_exit_command(password):
                self.log_operation("User exit", True, "Exit command during password input")
                print(f"\n{Colors.WARNING}👋 Arrêt du script demandé par l'utilisateur.{Colors.ENDC}")
                return "EXIT"
            
            if password:
                return password
            print(f"{Colors.FAIL}❌ Le mot de passe ne peut pas être vide !{Colors.ENDC}")

    def step_1_config(self) -> bool:
        """Étape 1 : Collecte des paramètres du projet"""
        self.current_step = 1
        self.clear_screen()
        self.print_header()
        self.print_progress_bar()
        self.print_step_header(1, "🔧 ÉTAPE 1/7 : CONFIGURATION DES PARAMÈTRES")
        
        intro = """Bienvenue dans l'assistant de configuration de votre déploiement Git sur OVH.
Nous allons collecter les paramètres nécessaires pour lier votre projet local à votre hébergement."""
        self.print_box("💡 PRÉSENTATION", intro)
        
        hostname = self.get_user_input("Adresse IP ou domaine du serveur SSH", self.config.get('hostname', 'ssh.cluster100.hosting.ovh.net'))
        if hostname == "EXIT": return False
        
        port_str = self.get_user_input("Port SSH", str(self.config.get('port', 22)))
        if port_str == "EXIT": return False
        try:
            port = int(port_str)
        except ValueError:
            port = 22
        
        # Génération de l'URL d'administration FTP/SSH d'OVH
        domain = hostname
        if domain.startswith("ssh."):
            domain = domain[4:]
        url_manager = f"https://manager.eu.ovhcloud.com/#/web/hosting/{domain}/ftp"
        
        info_user = f"""Pour trouver ou créer votre nom d'utilisateur SSH :
1. Rendez-vous sur votre espace client OVH :
   {url_manager}
2. Cliquez sur l'onglet 'FTP - SSH'.
3. Pour plus de sécurité et de stabilité, il est fortement conseillé de créer un utilisateur SSH dédié (avec son propre mot de passe) pour chaque site/projet."""
        self.print_box("🔑 CONSEIL SÉCURITÉ & STABILITÉ (OVH)", info_user, Colors.OKCYAN)
        
        open_web = self.get_yes_no_input("Souhaitez-vous ouvrir cette page dans votre navigateur internet ?")
        if open_web == "EXIT": return False
        if open_web in ['y', 'yes']:
            import webbrowser
            try:
                webbrowser.open(url_manager)
                print(f"{Colors.OKGREEN}✅ Page ouverte dans votre navigateur !{Colors.ENDC}")
            except Exception as e:
                self.logger.warning(f"Impossible d'ouvrir le navigateur : {e}")
                
        username = self.get_user_input("Nom d'utilisateur SSH distant", self.config.get('username', ''))
        if username == "EXIT": return False
        
        local_dir = self.get_user_input("Chemin de votre projet local", self.config.get('local_project_dir', os.getcwd()))
        if local_dir == "EXIT": return False
        local_dir = os.path.abspath(os.path.expanduser(local_dir))
        
        suggested_web = f"/home/{username}/www" if username else "/home/user/www"
        suggested_bare = f"/home/{username}/site.git" if username else "/home/user/site.git"
        
        web_dir = self.get_user_input("Dossier web distant public (ex: /home/user/www)", self.config.get('web_dir', suggested_web))
        if web_dir == "EXIT": return False
        
        bare_repo = self.get_user_input("Chemin absolu du dépôt Git bare distant (ex: /home/user/site.git)", self.config.get('bare_repo', suggested_bare))
        if bare_repo == "EXIT": return False
        
        # Sauvegarde
        self.config['hostname'] = hostname
        self.config['port'] = port
        self.config['username'] = username
        self.config['local_project_dir'] = local_dir
        self.config['web_dir'] = web_dir
        self.config['bare_repo'] = bare_repo
        self.save_config()
        
        recap = f"""Configuration enregistrée :
• Serveur : {hostname}:{port}
• Utilisateur SSH : {username}
• Répertoire Local : {local_dir}
• Répertoire Public distant : {web_dir}
• Dépôt Bare distant : {bare_repo}"""
        self.print_box("✅ CONFIGURATION SAUVEGARDÉE", recap, Colors.OKGREEN)
        time.sleep(1.5)
        return True

    def step_2_cle_gen(self) -> bool:
        """Étape 2 : Génération locale des clés SSH"""
        self.current_step = 2
        self.clear_screen()
        self.print_header()
        self.print_progress_bar()
        self.print_step_header(2, "🔑 ÉTAPE 2/7 : GÉNÉRATION DE LA CLÉ SSH DÉDIÉE")
        
        info = """Nous allons maintenant générer une paire de clés SSH (ed25519 avec repli RSA) dédiée localement pour ce projet.
Cette clé sera stockée dans le dossier '.ssh/' à la racine de votre projet et sera configurée pour être ignorée par Git."""
        self.print_box("💡 CRÉATION DE LA CLÉ DÉDIÉE", info)
        
        local_project_dir = self.config.get('local_project_dir', os.getcwd())
        ssh_dir = os.path.join(local_project_dir, '.ssh')
        key_path = os.path.join(ssh_dir, 'id_prod')
        
        self.animate_loading("Génération de la paire de clés SSH en cours...", 2)
        
        success = self.ssh_client.generate_local_key_pair(key_path)
        if not success:
            self.print_box("❌ ERREUR DE GÉNÉRATION", "Échec lors de la création de la clé locale. Vérifiez vos droits d'écriture.", Colors.FAIL)
            return False
            
        success_msg = f"""Paire de clés SSH générée avec succès !
• Clé privée : {key_path}
• Clé publique : {key_path}.pub

Le dossier '.ssh/' a également été correctement configuré dans le fichier '.gitignore' de votre projet pour éviter toute fuite de clés privées."""
        self.print_box("✅ CLÉS SSH GÉNÉRÉES ET ISOLÉES", success_msg, Colors.OKGREEN)
        time.sleep(1.5)
        return True

    def step_3_connexion(self) -> bool:
        """Étape 3 : Connexion SSH avec mot de passe"""
        self.current_step = 3
        self.clear_screen()
        self.print_header()
        self.print_progress_bar()
        self.print_step_header(3, "📡 ÉTAPE 3/7 : TEST DE CONNEXION INITIALE (MOT DE PASSE)")
        
        info = f"""Pour installer la clé publique sur votre hébergement OVH, nous devons d'abord nous y connecter à l'aide de votre mot de passe SSH OVH.
Veuillez saisir votre mot de passe SSH distant (la saisie sera masquée)."""
        self.print_box("💡 AUTHENTIFICATION REQUISE", info)
        
        password = self.get_password_input("Mot de passe SSH distant")
        if password == "EXIT": return False
        
        self.animate_loading("Tentative de connexion au serveur distant...", 2)
        
        success = self.ssh_client.connect(
            hostname=self.config['hostname'],
            username=self.config['username'],
            port=self.config['port'],
            password=password
        )
        
        if not success:
            err_msg = f"""Impossible de se connecter au serveur {self.config['hostname']} avec l'utilisateur {self.config['username']}.
Veuillez vérifier :
1. Le mot de passe saisi.
2. Que l'accès SSH est bien activé sur votre hébergement OVH.
3. Vos paramètres de serveur/port."""
            self.print_box("❌ ÉCHEC DE LA CONNEXION", err_msg, Colors.FAIL)
            
            retry = self.get_yes_no_input("Voulez-vous réessayer ?")
            if retry == "EXIT" or retry in ['n', 'no']:
                return False
            return self.step_3_connexion()
            
        success_msg = f"""Connexion établie avec succès !
Serveur : {self.config['hostname']}
Utilisateur : {self.config['username']}"""
        self.print_box("✅ CONNEXION SSH ÉTABLIE", success_msg, Colors.OKGREEN)
        time.sleep(1.5)
        return True

    def step_4_cle_push(self) -> bool:
        """Étape 4 : Téléversement et test de la clé SSH"""
        self.current_step = 4
        self.clear_screen()
        self.print_header()
        self.print_progress_bar()
        self.print_step_header(4, "📤 ÉTAPE 4/7 : TRANSFERT DE LA CLÉ PUBLIQUE")
        
        info = """Nous allons maintenant transférer la clé publique vers le serveur distant dans le fichier '~/.ssh/authorized_keys'.
Une fois ajoutée, nous déconnecterons la session actuelle et validerons que vous pouvez vous connecter sans mot de passe à l'aide de la clé générée."""
        self.print_box("💡 COPIE DE LA CLÉ SUR LE SERVEUR", info)
        
        local_project_dir = self.config.get('local_project_dir', os.getcwd())
        key_path = os.path.join(local_project_dir, '.ssh', 'id_prod')
        
        self.animate_loading("Upload et configuration de la clé publique...", 2)
        
        # Upload
        success = self.ssh_client.upload_public_key(key_path)
        if not success:
            self.print_box("❌ ERREUR DE TRANSFERT", "Échec lors de l'ajout de la clé publique au fichier authorized_keys.", Colors.FAIL)
            return False
            
        self.animate_loading("Déconnexion et validation de l'accès par clé...", 2)
        self.ssh_client.disconnect()
        
        # Re-connect using key filename
        success = self.ssh_client.connect(
            hostname=self.config['hostname'],
            username=self.config['username'],
            port=self.config['port'],
            key_file=key_path
        )
        
        if not success:
            err_msg = f"""La clé publique a été ajoutée mais le test de connexion par clé privée a échoué.
Veuillez vérifier :
1. Que votre hébergeur OVH autorise bien les connexions par clé.
2. Que les permissions sur les dossiers distants sont correctes."""
            self.print_box("❌ ÉCHEC DU TEST DE CLÉ", err_msg, Colors.FAIL)
            return False
            
        success_msg = """Le test de connexion par clé SSH dédiée a fonctionné !
Vous pouvez maintenant communiquer avec le serveur sans avoir à saisir votre mot de passe à chaque fois. Tout est sécurisé."""
        self.print_box("✅ TEST D'ACCÈS PAR CLÉ RÉUSSI", success_msg, Colors.OKGREEN)
        time.sleep(1.5)
        return True

    def step_5_distant(self) -> bool:
        """Étape 5 : Configuration des répertoires et du hook Git distant"""
        self.current_step = 5
        self.clear_screen()
        self.print_header()
        self.print_progress_bar()
        self.print_step_header(5, "🏗️ ÉTAPE 5/7 : CONFIGURATION DISTANTE")
        
        info = f"""Nous configurons maintenant l'environnement distant sur votre hébergement :
• Création du dossier web public : {self.config['web_dir']}
• Initialisation du dépôt Git bare distant : {self.config['bare_repo']}
• Installation du script de hook 'post-receive' (déploiement automatique lors d'un push)"""
        self.print_box("💡 CONFIGURATION DES REPERTOIRES ET DES HOOKS", info)
        
        self.animate_loading("Initialisation du dépôt distant bare et du hook...", 2)
        
        success = self.ssh_client.configure_remote_git_deployment(
            web_dir=self.config['web_dir'],
            bare_repo=self.config['bare_repo']
        )
        
        if not success:
            self.print_box("❌ ERREUR DISTANTE", "Échec lors de l'initialisation du dépôt bare distant ou de l'installation du hook post-receive.", Colors.FAIL)
            return False
            
        success_msg = f"""Le serveur distant est prêt !
• Répertoires créés avec succès.
• Dépôt bare initialisé dans {self.config['bare_repo']}
• Script de hook de déploiement automatique 'hooks/post-receive' installé et rendu exécutable."""
        self.print_box("✅ SERVEUR CONFIGURÉ", success_msg, Colors.OKGREEN)
        time.sleep(1.5)
        return True

    def step_6_git_local(self) -> bool:
        """Étape 6 : Initialisation et configuration Git locale"""
        self.current_step = 6
        self.clear_screen()
        self.print_header()
        self.print_progress_bar()
        self.print_step_header(6, "💻 ÉTAPE 6/7 : CONFIGURATION DE GIT LOCAL & DU FLUX")
        
        info = """Nous configurons votre dépôt Git local :
1. Initialisation Git si absente.
2. Configuration de 'remote.production.sshCommand' pour utiliser votre clé SSH locale dédiée de façon portable.
3. Ajout de l'URL distante sous le nom 'production'."""
        self.print_box("💡 INITIALISATION ET CONFIGURATION DE GIT", info)
        
        local_project_dir = self.config.get('local_project_dir', os.getcwd())
        key_path = os.path.join('.ssh', 'id_prod')
        
        old_cwd = os.getcwd()
        os.chdir(local_project_dir)
        
        self.animate_loading("Configuration locale en cours...", 2)
        
        success = self.ssh_client.configure_local_git_repository(
            hostname=self.config['hostname'],
            username=self.config['username'],
            bare_repo=self.config['bare_repo'],
            key_path=key_path
        )
        
        if not success:
            os.chdir(old_cwd)
            self.print_box("❌ ERREUR LOCALE GIT", "Échec de la configuration Git locale. Assurez-vous d'avoir Git installé et disponible sur votre système.", Colors.FAIL)
            return False
            
        branch = "master"
        try:
            result = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip() != "HEAD":
                branch = result.stdout.strip()
        except Exception:
            pass
            
        success_msg = f"""Configuration locale Git terminée !
• Option 'remote.production.sshCommand' appliquée de manière relative et portable.
• Remote 'production' configuré vers {self.config['username']}@{self.config['hostname']}:{self.config['bare_repo']}
• Branche courante détectée : {branch}"""
        self.print_box("✅ DEPOT LOCAL CONFIGURÉ", success_msg, Colors.OKGREEN)
        
        # Menu interactif de choix de flux de déploiement
        print(f"\n{Colors.OKCYAN}{Colors.BOLD}Comment souhaitez-vous gérer la synchronisation entre GitHub et OVH ?{Colors.ENDC}")
        print(f"1. {Colors.BOLD}Déploiement direct indépendant{Colors.ENDC}")
        print("   Vous gérez manuellement et indépendamment les deux remotes (git push origin ET git push production).")
        print(f"2. {Colors.BOLD}Déploiement simultané via alias Git{Colors.ENDC}")
        print("   Vous utilisez la commande 'git pushall' pour pousser sur GitHub et sur OVH en une seule fois.")
        print(f"3. {Colors.BOLD}Déploiement automatique sécurisé via GitHub Actions (Recommandé){Colors.ENDC}")
        print(f"   Vous poussez uniquement sur GitHub (ou créez une Release) et GitHub déploie sur OVH automatiquement.")
        print(f"4. {Colors.BOLD}Supprimer la dépendance à GitHub (Conserver l'historique local){Colors.ENDC}")
        print(f"   Supprime le lien vers GitHub (remote origin) pour ne déployer que sur votre serveur OVH.")
        
        while True:
            choix = self.get_user_input("Saisissez votre choix (1, 2, 3 ou 4)", "3")
            if choix == "EXIT":
                os.chdir(old_cwd)
                return False
            if choix in ['1', '2', '3', '4']:
                break
            print(f"{Colors.FAIL}❌ Option invalide ! Veuillez saisir 1, 2, 3 ou 4.{Colors.ENDC}")
            
        self.config['deploy_workflow'] = choix
        self.save_config()
        
        if choix == '2':
            self.animate_loading("Configuration de l'alias Git pushall...", 1)
            origin_exists = False
            result_remote = subprocess.run(['git', 'remote'], capture_output=True, text=True)
            if result_remote.returncode == 0:
                remotes = [r.strip() for r in result_remote.stdout.split('\n') if r.strip()]
                if "origin" in remotes:
                    origin_exists = True
            
            alias_cmd = '!f() { git push origin "$@" && git push production "$@"; }; f'
            subprocess.run(['git', 'config', 'alias.pushall', alias_cmd], capture_output=True)
            
            msg_alias = "Alias Git 'pushall' configuré avec succès !\nVous pourrez désormais utiliser la commande : git pushall"
            if not origin_exists:
                msg_alias += "\n\n⚠️ Note : Le remote 'origin' n'a pas encore été détecté dans ce projet.\nL'alias fonctionnera dès que vous aurez lié votre projet à GitHub (git remote add origin ...)."
            self.print_box("ℹ️ ALIAS CONFIGURÉ", msg_alias, Colors.OKGREEN)
            time.sleep(2)
            
        elif choix == '3':
            self.animate_loading("Génération du workflow GitHub Actions...", 1)
            workflows_dir = os.path.join(local_project_dir, '.github', 'workflows')
            os.makedirs(workflows_dir, exist_ok=True)
            
            deploy_yml_path = os.path.join(workflows_dir, 'deploy.yml')
            
            yaml_content = f"""name: Deploy to OVH Production

on:
  push:
    branches:
      - {branch}
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup SSH Key
        run: |
          mkdir -p ~/.ssh
          echo "{'${{ secrets.OVH_SSH_KEY }}'}" > ~/.ssh/id_prod
          chmod 600 ~/.ssh/id_prod
          ssh-keyscan -p {self.config['port']} -H "{self.config['hostname']}" >> ~/.ssh/known_hosts

      - name: Deploy via Git Push to OVH
        run: |
          git remote add production {self.config['username']}@{self.config['hostname']}:{self.config['bare_repo']}
          git config remote.production.sshCommand "ssh -i ~/.ssh/id_prod -o IdentitiesOnly=yes -o StrictHostKeyChecking=no"
          git push -f production "{'${{ github.ref }}'}:refs/heads/{branch}"
"""
            try:
                with open(deploy_yml_path, 'w', encoding='utf-8') as f:
                    f.write(yaml_content)
                self.logger.info(f"Fichier de workflow GitHub Actions écrit dans {deploy_yml_path}")
                self.print_box("ℹ️ WORKFLOW GÉNÉRÉ", f"Le fichier de configuration GitHub Actions a été créé :\n.github/workflows/deploy.yml\n\nIl automatisera le déploiement sur la branche '{branch}' lors d'un push ou d'une Release.", Colors.OKGREEN)
            except Exception as e:
                self.logger.error(f"Erreur lors de la création du fichier yml: {e}")
                self.print_box("❌ ERREUR WORKFLOW", f"Impossible de générer le fichier deploy.yml : {e}", Colors.FAIL)
            time.sleep(2)

        elif choix == '4':
            self.animate_loading("Suppression du lien vers GitHub (remote origin)...", 1)
            subprocess.run(['git', 'remote', 'remove', 'origin'], capture_output=True)
            self.print_box("ℹ️ CONFIGURATION DE FLUX UNIQUE", "Le lien vers GitHub (remote 'origin') a été retiré.\nVotre historique local a été entièrement conservé et le projet ne dépendra plus que de votre serveur OVH.", Colors.OKGREEN)
            time.sleep(2)
            
        # Pour l'option 3, on ne pousse pas automatiquement car le secret GitHub n'est pas encore renseigné.
        if choix == '3':
            print(f"\n{Colors.WARNING}⚠️ Rappel : Pour GitHub Actions, vous devrez d'abord configurer le secret 'OVH_SSH_KEY' sur GitHub (voir instructions à l'étape finale).{Colors.ENDC}")
            print(f"{Colors.OKBLUE}Nous finalisons la configuration sans push automatique.{Colors.ENDC}")
            os.chdir(old_cwd)
            time.sleep(2)
            return True
            
        first_push = self.get_yes_no_input("Souhaitez-vous effectuer le premier commit et push vers la production maintenant ?")
        if first_push == "EXIT":
            os.chdir(old_cwd)
            return False
            
        if first_push in ['y', 'yes']:
            self.animate_loading("Préparation du premier déploiement...", 1)
            
            subprocess.run(['git', 'add', '.'], capture_output=True)
            commit_msg = "Initialisation du deploiement automatique sur OVH"
            subprocess.run(['git', 'commit', '-m', commit_msg], capture_output=True)
            
            print(f"\n{Colors.OKCYAN}🚀 Envoi du code sur le serveur OVH (branche {branch})...{Colors.ENDC}")
            
            cmd_push = ['git', 'push', '-u', 'production', branch]
            result_push = subprocess.run(cmd_push, capture_output=True, text=True)
            
            if result_push.returncode == 0:
                print(f"{Colors.OKGREEN}✅ Code déployé avec succès sur OVH !{Colors.ENDC}")
                self.logger.info("Premier push réussi avec succès")
                if result_push.stdout:
                    print(f"\n{Colors.OKBLUE}Sortie de Git : {Colors.ENDC}")
                    print(result_push.stdout)
            else:
                print(f"\n{Colors.WARNING}⚠️ Le push Git a retourné un avertissement ou une erreur : {Colors.ENDC}")
                print(result_push.stderr)
                self.logger.warning(f"Push échoué ou partiel: {result_push.stderr}")
                print(f"\n{Colors.OKCYAN}💡 Pas de panique : vous pourrez pousser votre code manuellement plus tard.{Colors.ENDC}")
                
        os.chdir(old_cwd)
        time.sleep(1.5)
        return True

    def step_7_fin(self) -> bool:
        """Étape 7 : Bilan final et explications d'utilisation"""
        self.current_step = 7
        self.clear_screen()
        self.print_header()
        self.print_progress_bar()
        self.print_step_header(7, "🎉 ÉTAPE 7/7 : CONFIGURATION TERMINÉE AVEC SUCCÈS !")
        
        local_project_dir = self.config.get('local_project_dir', os.getcwd())
        choix = self.config.get('deploy_workflow', '3')
        
        # Get branch name
        branch = "master"
        old_cwd = os.getcwd()
        try:
            os.chdir(local_project_dir)
            result = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip() != "HEAD":
                branch = result.stdout.strip()
        except Exception:
            pass
        finally:
            os.chdir(old_cwd)
            
        ssh_dir = os.path.join(local_project_dir, '.ssh')
        key_path = os.path.join(ssh_dir, 'id_prod')
        
        recap_msg = f"""Votre environnement de déploiement automatique Git SSH sur OVH est prêt !

📋 BILAN DE LA CONFIGURATION :
• Projet local : {local_project_dir}
• Dépôt bare distant : {self.config['bare_repo']}
• Dossier public distant : {self.config['web_dir']}
• Clé SSH privée utilisée : .ssh/id_prod (dans votre projet)
• Branche de déploiement : {branch}
• Mode de synchronisation choisi : Option {choix}"""

        self.print_box("🏆 CONFIGURATION EFFECTUÉE !", recap_msg, Colors.OKGREEN)
        
        # Instructions adaptées selon l'option
        if choix == '1':
            usage_msg = f"""🚀 UTILISATION AU QUOTIDIEN (Déploiement direct) :
Pour déployer vos modifications de code vers votre serveur OVH :
1. Faites vos modifications de code
2. Indexez les fichiers :
   git add .
3. Validez vos modifications :
   git commit -m "Description de vos modifications"
4. Poussez vers la production OVH :
   git push production {branch}
5. Poussez vers GitHub (si configuré) :
   git push origin {branch}

Le serveur OVH effectuera automatiquement la mise à jour du dossier public."""
            self.print_box("📖 GUIDE DE DÉPLOIEMENT", usage_msg, Colors.OKBLUE)
            
        elif choix == '2':
            usage_msg = f"""🚀 UTILISATION AU QUOTIDIEN (Simultané via alias 'pushall') :
Pour pousser simultanément votre code sur GitHub ET sur votre serveur de production OVH :
1. Faites vos modifications de code
2. Indexez les fichiers :
   git add .
3. Validez vos modifications :
   git commit -m "Description de vos modifications"
4. Poussez partout en une seule commande :
   git pushall

Git poussera sur votre dépôt GitHub distant (origin) et sur OVH (production).
Le serveur OVH effectuera automatiquement la mise à jour du dossier public."""
            self.print_box("📖 GUIDE DE DÉPLOIEMENT", usage_msg, Colors.OKBLUE)
            
        elif choix == '3':
            usage_msg = f"""⚠️ CONFIGURATION FINALE REQUISE (GitHub Actions) :
Pour que GitHub Actions puisse pousser votre code sur OVH, vous devez déclarer votre clé privée SSH en tant que secret de dépôt sur GitHub.

Suivez ce guide rapide :
1. Ouvrez votre dépôt GitHub dans votre navigateur.
2. Cliquez sur l'onglet 'Settings' (Paramètres) en haut.
3. Dans la barre latérale gauche, allez dans 'Secrets and variables' puis cliquez sur 'Actions'.
4. Cliquez sur le bouton 'New repository secret'.
5. Renseignez les informations suivantes :
   • Nom : OVH_SSH_KEY
   • Valeur : (Copiez et collez le contenu complet du fichier de clé privée local ci-dessous)
   
   Chemin de votre clé privée locale : {key_path}

🚀 UTILISATION AU QUOTIDIEN :
Une fois le secret configuré, vous n'avez plus besoin de pousser manuellement sur OVH !
1. Validez vos modifications de code :
   git add .
   git commit -m "Description de vos modifications"
2. Poussez simplement sur GitHub :
   git push origin {branch} (ou créez une Release sur GitHub)
3. GitHub Actions déploie automatiquement vos changements sur OVH en tâche de fond !"""
            self.print_box("📖 GUIDE D'INSTALLATION & DE DÉPLOIEMENT", usage_msg, Colors.WARNING)
            
        elif choix == '4':
            usage_msg = f"""🚀 UTILISATION AU QUOTIDIEN (Déploiement OVH uniquement) :
Le lien vers GitHub a été retiré. Pour déployer vos modifications directement sur OVH :
1. Faites vos modifications de code
2. Indexez les fichiers :
   git add .
3. Validez vos modifications :
   git commit -m "Description de vos modifications"
4. Poussez vers la production OVH :
   git push production {branch}

Le serveur OVH recevra vos commits et mettra automatiquement à jour le dossier public."""
            self.print_box("📖 GUIDE DE DÉPLOIEMENT", usage_msg, Colors.OKBLUE)
            
        return True

    def run(self) -> bool:
        """Lance l'exécution séquentielle des 7 étapes"""
        try:
            if not self.step_1_config():
                return self.handle_exit(False)
            if not self.step_2_cle_gen():
                return self.handle_exit(False)
            if not self.step_3_connexion():
                return self.handle_exit(False)
            if not self.step_4_cle_push():
                return self.handle_exit(False)
            if not self.step_5_distant():
                return self.handle_exit(False)
            if not self.step_6_git_local():
                return self.handle_exit(False)
            if not self.step_7_fin():
                return self.handle_exit(False)
                
            print(f"\n{Colors.OKGREEN}🎉 Félicitations, déploiement configuré à 100% !{Colors.ENDC}")
            self.logger.info("Déploiement configuré à 100% avec succès.")
            return True
        except KeyboardInterrupt:
            print(f"\n\n{Colors.WARNING}⚠️ Opération interrompue par l'utilisateur (Ctrl+C).{Colors.ENDC}")
            self.logger.warning("Opération interrompue par l'utilisateur (Ctrl+C).")
            return self.handle_exit(False)
        except Exception as e:
            print(f"\n{Colors.FAIL}❌ Une erreur inattendue est survenue : {e}{Colors.ENDC}")
            self.logger.error(f"Erreur inattendue : {e}", exc_info=True)
            return self.handle_exit(False)

    def handle_exit(self, success: bool = False) -> bool:
        """Termine proprement l'exécution"""
        if self.ssh_client:
            self.ssh_client.disconnect()
        print(f"\n{Colors.OKBLUE}👋 Fin du script.{Colors.ENDC}\n")
        return success

def main():
    """Fonction principale"""
    creator = OVHRepoCreator()
    success = creator.run()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
