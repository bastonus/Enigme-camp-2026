<?php
/**
 * save_result.php
 * Intelligent backend to register successful puzzle completions.
 * Uses atomic file operations with exclusive locking for safe concurrent access.
 */

header('Content-Type: application/json; charset=utf-8');

// Prevent Cloudflare / browser caching
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Helper function to parse durations like "1m 24s" into total seconds for correct sorting
function parseDurationToSeconds($durationStr) {
    if (empty($durationStr) || $durationStr === '—' || $durationStr === 'N/A') {
        return 999999;
    }
    if (preg_match('/(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i', $durationStr, $matches)) {
        $minutes = isset($matches[1]) && $matches[1] !== '' ? (int)$matches[1] : 0;
        $seconds = isset($matches[2]) && $matches[2] !== '' ? (int)$matches[2] : 0;
        return ($minutes * 60) + $seconds;
    }
    return 999999;
}

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
            // Clean up data: ensure unique ID exists and redundant ranks are stripped
            foreach ($results as &$entry) {
                if (empty($entry['id'])) {
                    $entry['id'] = uniqid('agent_', true);
                }
                if (isset($entry['rank'])) {
                    unset($entry['rank']);
                }
            }
            unset($entry);
        }
    }
    
    // Check if player has already submitted to avoid duplicates
    $isDuplicate = false;
    $isTest = (stripos($firstnameClean, 'test') !== false) || 
              (stripos($firstnameClean, 'admin') !== false) || 
              (stripos($lastnameClean, 'test') !== false) || 
              (stripos($lastnameClean, 'admin') !== false);

    if (!$isTest) {
        foreach ($results as $res) {
            if (strcasecmp($res['firstname'], $firstnameClean) === 0 && strcasecmp($res['lastname'], $lastnameClean) === 0) {
                $isDuplicate = true;
                break;
            }
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

    // IP-based anti-cheat check to prevent multiple submissions from the same station
    $clientIp = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $isDuplicateIp = false;
    if (!$isTest) {
        foreach ($results as $res) {
            if (isset($res['ip']) && $res['ip'] === $clientIp) {
                // Safe developer/localhost exception
                if ($clientIp !== '127.0.0.1' && $clientIp !== '::1') {
                    $isDuplicateIp = true;
                    break;
                }
            }
        }
    }

    if ($isDuplicateIp) {
        flock($fp, LOCK_UN);
        fclose($fp);
        echo json_encode([
            'success' => false,
            'error' => 'Cette adresse IP a déjà transmis un rapport de mission. Une seule transmission par poste est autorisée.'
        ]);
        exit;
    }
    
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

    $duration = isset($data['duration']) ? trim((string)$data['duration']) : '';
    if ($duration === '') {
        $duration = '—';
    }
    
    $newEntryId = uniqid('agent_', true);

    $newEntry = [
        'id' => $newEntryId,
        'firstname' => $firstnameClean,
        'lastname' => $lastnameClean,
        'duration' => $duration,
        'timestamp' => $timestampFormatted,
        'ip' => $clientIp
    ];
    
    $results[] = $newEntry;

    // Sort all results dynamically by duration (completion time) ascending
    usort($results, function($a, $b) {
        $timeA = parseDurationToSeconds(isset($a['duration']) ? $a['duration'] : '');
        $timeB = parseDurationToSeconds(isset($b['duration']) ? $b['duration'] : '');
        return $timeA - $timeB;
    });

    // Reassign ranks temporarily for getting response rank, and remove rank property from saved format
    $assignedRank = 1;
    foreach ($results as $index => &$res) {
        $tempRank = $index + 1;
        if ($res['id'] === $newEntryId) {
            $assignedRank = $tempRank;
        }
        if (isset($res['rank'])) {
            unset($res['rank']);
        }
    }
    unset($res);
    
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
        'rank' => $assignedRank,
        'id' => $newEntryId,
        'message' => 'Félicitations ! Votre réussite a été enregistrée avec succès. Vous êtes classé #' . $assignedRank . '.'
    ]);
} else {
    fclose($fp);
    echo json_encode([
        'success' => false,
        'error' => 'Erreur de verrouillage de la base de données concurrentielle.'
    ]);
}
