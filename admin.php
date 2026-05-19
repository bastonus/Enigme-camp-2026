<?php
/**
 * admin.php
 * Clandestine Archives Enigma Scoreboard.
 * Left-aligned, vintage typewriter style showing all successful agents.
 */

// Set timezone to match local scouts context
date_default_timezone_set('Europe/Paris');

$dbPath = __DIR__ . '/data/results.json';
$results = [];

if (file_exists($dbPath)) {
    $content = file_get_contents($dbPath);
    $decoded = json_decode($content, true);
    if (is_array($decoded)) {
        $results = $decoded;
    }
}

// Optional CSV Export triggered by GET query
if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=rapport_resistance_cubjac_' . date('Ymd_His') . '.csv');
    
    $output = fopen('php://output', 'w');
    // Write UTF-8 BOM for correct Excel encoding
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    fputcsv($output, ['Ordre / Rang', 'Prénom', 'Nom de famille', 'Date d\'enregistrement']);
    foreach ($results as $res) {
        fputcsv($output, [
            $res['rank'],
            $res['firstname'],
            $res['lastname'],
            $res['timestamp']
        ]);
    }
    fclose($output);
    exit;
}

$totalAgents = count($results);
$lastRegistration = $totalAgents > 0 ? $results[$totalAgents - 1]['timestamp'] : 'Aucun';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ARCHIVES CONFIDENTIELLES — PC CUBJAC 1944</title>
  
  <!-- Google Fonts for authentic look -->
  <link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=VT323&display=swap" rel="stylesheet">
  
  <style>
    /* Reset and General terminal theme styling */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background: #000;
      color: #B8A070;
      font-family: 'Special Elite', cursive;
      font-size: 1rem;
      line-height: 1.5;
      padding: 2.5rem 1rem;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      position: relative;
      overflow-x: hidden;
    }

    /* Film grain CRT overlay animation */
    body::before {
      content: '';
      position: absolute; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
      pointer-events: none; opacity: 0.25;
      animation: grain-shift 0.12s steps(1) infinite;
      z-index: 100;
    }
    
    @keyframes grain-shift {
      0%   { transform: translate(0,0); }
      25%  { transform: translate(-2px, 1px); }
      50%  { transform: translate(2px,-1px); }
      75%  { transform: translate(-1px,2px); }
      100% { transform: translate(1px,-2px); }
    }

    /* Dossier Container - Clandestine terminal box style */
    .dossier-container {
      width: 100%;
      max-width: 900px;
      background: rgba(10, 8, 4, 0.95);
      border: 1px solid #333;
      padding: 3rem 3.5rem;
      position: relative;
      z-index: 10;
      box-shadow: 0 20px 50px rgba(0,0,0,0.85);
    }

    .dossier-container::after {
      content: 'ARCHIVES DES ENREGISTREMENTS — PC CUBJAC';
      position: absolute; top: -0.7rem; left: 1.5rem;
      background: #000; color: #555;
      font-size: 0.7rem; font-family: 'VT323', monospace; letter-spacing: .15em; padding: 0 .5rem;
    }
    
    /* Confidentiel Stencil stamp */
    .stamp-confidentiel {
      position: absolute;
      top: 2rem;
      right: 2rem;
      border: 2px dashed #B8A070;
      color: #B8A070;
      font-family: 'Special Elite', cursive;
      font-size: 0.95rem;
      font-weight: bold;
      padding: 4px 10px;
      text-transform: uppercase;
      transform: rotate(-3deg);
      opacity: 0.75;
      user-select: none;
      pointer-events: none;
      letter-spacing: 2px;
    }

    /* Header styling - strictly left-aligned */
    .header-block {
      border-bottom: 1px solid #333;
      padding-bottom: 1.2rem;
      margin-bottom: 2rem;
      text-align: left;
    }
    
    .header-block h1 {
      font-size: 1.8rem;
      font-family: 'VT323', monospace;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #B8A070;
      margin-bottom: 0.5rem;
    }
    
    .header-block p {
      font-size: 0.9rem;
      font-family: 'VT323', monospace;
      color: #666;
      letter-spacing: 0.5px;
    }

    /* Quick stats cards - left aligned */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
      text-align: left;
    }
    
    .stat-card {
      background: rgba(184, 160, 112, 0.02);
      border: 1px dashed #333;
      padding: 1rem 1.2rem;
      border-radius: 1px;
    }
    
    .stat-label {
      font-size: 0.75rem;
      font-family: 'VT323', monospace;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 0.3rem;
      letter-spacing: 1px;
    }
    
    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #B8A070;
      font-family: 'VT323', monospace;
    }

    /* Controls block - strictly left-aligned */
    .controls-block {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      text-align: left;
    }
    
    .search-box {
      position: relative;
      flex: 1;
      min-width: 250px;
    }
    
    .search-input {
      width: 100%;
      background: rgba(0,0,0,0.4);
      border: 1px solid #333;
      padding: 0.6rem 1rem;
      font-family: 'Special Elite', cursive;
      font-size: 0.85rem;
      color: #B8A070;
      outline: none;
      border-radius: 1px;
      transition: border-color 0.2s;
    }
    
    .search-input:focus {
      border-color: #B8A070;
      background: rgba(0,0,0,0.6);
    }
    
    /* Interactive retro action button - styling like start prompt */
    .btn-action {
      background: transparent;
      border: 1.5px solid #B8A070;
      color: #B8A070;
      font-family: 'VT323', monospace;
      font-size: 1.1rem;
      letter-spacing: 1px;
      padding: 0.5rem 1.5rem;
      cursor: pointer;
      border-radius: 1px;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      outline: none;
    }
    
    .btn-action:hover {
      background: #B8A070;
      color: #000;
    }

    /* Scoreboard Table Styles - Left Aligned */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      margin-bottom: 2rem;
      border: 1px solid #333;
    }
    
    .archive-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.95rem;
    }
    
    .archive-table th {
      background: #111;
      color: #B8A070;
      padding: 0.8rem 1rem;
      font-family: 'VT323', monospace;
      font-size: 1.1rem;
      letter-spacing: 0.5px;
      font-weight: bold;
      text-transform: uppercase;
      border: 1px solid #333;
    }
    
    .archive-table td {
      padding: 0.8rem 1rem;
      border: 1px solid #222;
      color: #B8A070;
      font-family: 'Special Elite', cursive;
    }
    
    .archive-table tbody tr:nth-child(even) {
      background: rgba(20, 16, 10, 0.3);
    }
    
    .archive-table tbody tr:hover {
      background: rgba(184, 160, 112, 0.06);
    }
    
    /* Rank Column Badge Style */
    .rank-cell {
      font-weight: bold;
      font-family: 'VT323', monospace;
      font-size: 1.4rem;
      color: #B8A070;
    }
    
    .no-results {
      padding: 3rem 1rem;
      text-align: left;
      font-style: italic;
      color: #666;
      font-family: 'Special Elite', cursive;
    }
    
    /* Footer details */
    .dossier-footer {
      border-top: 1px dashed #333;
      padding-top: 1.5rem;
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #555;
      text-align: left;
      font-family: 'VT323', monospace;
      letter-spacing: 0.5px;
    }
    
    .btn-back {
      color: #B8A070;
      text-decoration: underline;
      cursor: pointer;
      font-weight: bold;
    }
    
    .btn-back:hover {
      color: #fff;
    }

    /* Print styling */
    @media print {
      body {
        background: none;
        padding: 0;
      }
      .dossier-container {
        box-shadow: none;
        border: none;
        padding: 0;
      }
      .btn-action, .search-box {
        display: none;
      }
    }
  </style>
</head>
<body>

  <div class="dossier-container">
    <!-- Confidentiel ink stamp -->
    <div class="stamp-confidentiel">SECRET F.F.I.</div>
    
    <!-- Top Header details -->
    <div class="header-block">
      <h1>Registre des Éclaireurs de la Résistance</h1>
      <p>BUREAU ALLIÉ DE TRANSMISSION DU PÉRIGORD — OPÉRATION CUBJAC 1944</p>
    </div>
    
    <!-- Key statistics -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Résistants Enregistrés</div>
        <div class="stat-value" id="stats-total"><?= $totalAgents ?> F.F.I.</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dernière Transmission</div>
        <div class="stat-value" style="font-size: 1.1rem; line-height: 1.6;"><?= $lastRegistration ?></div>
      </div>
    </div>
    
    <!-- Interactive Search and Export Controls -->
    <div class="controls-block">
      <div class="search-box">
        <input type="text" id="search-input" class="search-input" placeholder="🔍 Rechercher un agent par nom ou prénom..." oninput="filterTable()">
      </div>
      <a href="?export=csv" class="btn-action" title="Exporter au format CSV pour tableur">
        💾 EXPORTER EN CSV
      </a>
    </div>
    
    <!-- Scoreboard Table Wrapper -->
    <div class="table-wrapper">
      <table class="archive-table" id="archive-table">
        <thead>
          <tr>
            <th style="width: 15%;">Ordre</th>
            <th style="width: 30%;">Prénom</th>
            <th style="width: 30%;">Nom</th>
            <th style="width: 25%;">Heure d'Enregistrement</th>
          </tr>
        </thead>
        <tbody>
          <?php if ($totalAgents > 0): ?>
            <?php foreach ($results as $res): ?>
              <tr class="agent-row">
                <td class="rank-cell">#<?= sprintf('%02d', $res['rank']) ?></td>
                <td class="firstname-cell"><?= htmlspecialchars($res['firstname'], ENT_QUOTES, 'UTF-8') ?></td>
                <td class="lastname-cell"><?= htmlspecialchars($res['lastname'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars($res['timestamp'], ENT_QUOTES, 'UTF-8') ?></td>
              </tr>
            <?php endforeach; ?>
          <?php else: ?>
            <tr id="empty-row">
              <td colspan="4" class="no-results">
                📜 Aucun rapport reçu à ce jour. Le canal est silencieux... En attente du premier agent de liaison.
              </td>
            </tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
    
    <!-- Dossier Footer Details -->
    <div class="dossier-footer">
      <div>PC Opérationnel Périgord · R. GRANDOU - J.E. - WHISKY</div>
      <div class="btn-back" onclick="window.location.href='./index.html'">← Retour à la table d'opération</div>
    </div>
  </div>

  <script>
    /**
     * Interactive table filter for quick live agent lookups.
     */
    function filterTable() {
      const input = document.getElementById('search-input');
      const filter = input.value.toUpperCase().trim();
      const table = document.getElementById('archive-table');
      const rows = table.getElementsByClassName('agent-row');
      let visibleCount = 0;
      
      for (let i = 0; i < rows.length; i++) {
        const firstnameCell = rows[i].getElementsByClassName('firstname-cell')[0];
        const lastnameCell = rows[i].getElementsByClassName('lastname-cell')[0];
        if (firstnameCell && lastnameCell) {
          const text = (firstnameCell.textContent + ' ' + lastnameCell.textContent).toUpperCase();
          if (text.indexOf(filter) > -1) {
            rows[i].style.display = "";
            visibleCount++;
          } else {
            rows[i].style.display = "none";
          }
        }
      }
      
      // Toggle empty notification if search yields no matches
      let emptySearchRow = document.getElementById('empty-search-row');
      if (visibleCount === 0 && rows.length > 0) {
        if (!emptySearchRow) {
          emptySearchRow = document.createElement('tr');
          emptySearchRow.id = 'empty-search-row';
          emptySearchRow.innerHTML = `
            <td colspan="4" class="no-results" style="color: #B8A070;">
              ❌ Aucun résistant ne correspond à votre recherche.
            </td>
          `;
          table.querySelector('tbody').appendChild(emptySearchRow);
        }
      } else if (emptySearchRow) {
        emptySearchRow.remove();
      }
    }
  </script>
</body>
</html>
