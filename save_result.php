<?php
/**
 * save_result.php
 * Intelligent backend to register successful puzzle completions.
 * Uses atomic file operations with exclusive locking for safe concurrent access.
 */

header('Content-Type: application/json; charset=utf-8');

// Align with the French Scouting event timezone
date_default_timezone_set('Europe/Paris');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'error' => 'Méthode de requête non autorisée.'
    ]);
    exit;
}

// Read JSON input from request body
$inputRaw = file_get_contents('php://input');
$data = json_decode($inputRaw, true);

$firstname = isset($data['firstname']) ? trim((string)$data['firstname']) : '';
$lastname  = isset($data['lastname']) ? trim((string)$data['lastname']) : '';

if (empty($firstname) || empty($lastname)) {
    echo json_encode([
        'success' => false,
        'error' => 'Le prénom et le nom sont requis pour l\'enregistrement.'
    ]);
    exit;
}

// Clean and sanitize inputs to prevent script injection (XSS)
$firstnameClean = htmlspecialchars($firstname, ENT_QUOTES, 'UTF-8');
$lastnameClean  = htmlspecialchars($lastname, ENT_QUOTES, 'UTF-8');

$dir = __DIR__ . '/data';
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$dbPath = $dir . '/results.json';

// Open or create results database file with atomic lock
$fp = fopen($dbPath, 'c+');
if (!$fp) {
    echo json_encode([
        'success' => false,
        'error' => 'Impossible d\'accéder à la base de données.'
    ]);
    exit;
}

// Exclusively lock the file to prevent race conditions during order calculation
if (flock($fp, LOCK_EX)) {
    $fileSize = filesize($dbPath);
    $results = [];
    
    if ($fileSize > 0) {
        rewind($fp);
        $content = fread($fp, $fileSize);
        $decoded = json_decode($content, true);
        if (is_array($decoded)) {
            $results = $decoded;
        }
    }
    
    // Check if player has already submitted to avoid duplicates
    $isDuplicate = false;
    foreach ($results as $res) {
        if (strcasecmp($res['firstname'], $firstnameClean) === 0 && strcasecmp($res['lastname'], $lastnameClean) === 0) {
            $isDuplicate = true;
            break;
        }
    }
    
    if ($isDuplicate) {
        flock($fp, LOCK_UN);
        fclose($fp);
        echo json_encode([
            'success' => true,
            'message' => 'Résultat déjà enregistré précédemment ! La Résistance a bien reçu votre rapport.',
            'already_registered' => true
        ]);
        exit;
    }
    
    // Determine order rank (sequence order: 1st, 2nd, 3rd...)
    $rank = count($results) + 1;
    
    // Precise millisecond timestamp parsing in Paris timezone
    if (empty($data['completion_time'])) {
        $microtime = microtime(true);
        $seconds = floor($microtime);
        $milliseconds = round(($microtime - $seconds) * 1000);
    } else {
        $milliSecondsTimestamp = (float)$data['completion_time'];
        $seconds = floor($milliSecondsTimestamp / 1000);
        $milliseconds = (int)($milliSecondsTimestamp % 1000);
    }
    
    $dateTime = new DateTime();
    $dateTime->setTimestamp($seconds);
    $dateTime->setTimezone(new DateTimeZone('Europe/Paris'));
    $timestampFormatted = $dateTime->format('d/m/Y H:i:s') . '.' . sprintf('%03d', $milliseconds);
    
    $newEntry = [
        'rank' => $rank,
        'firstname' => $firstnameClean,
        'lastname' => $lastnameClean,
        'timestamp' => $timestampFormatted
    ];
    
    $results[] = $newEntry;
    
    // Truncate and write updated results
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    
    // Release lock
    flock($fp, LOCK_UN);
    fclose($fp);
    
    echo json_encode([
        'success' => true,
        'rank' => $rank,
        'message' => 'Félicitations ! Votre réussite a été enregistrée avec succès. Vous êtes classé #' . $rank . '.'
    ]);
} else {
    fclose($fp);
    echo json_encode([
        'success' => false,
        'error' => 'Erreur de verrouillage de la base de données concurrentielle.'
    ]);
}
