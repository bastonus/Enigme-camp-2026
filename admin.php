<?php
/**
 * admin.php
 * Clandestine Archives Enigma Scoreboard.
 * Left-aligned, vintage typewriter style showing all successful agents.
 */

// Prevent Cloudflare and browser caching
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

// Set timezone to match local scouts context
date_default_timezone_set('Europe/Paris');

$dbPath = __DIR__ . '/data/results.json';
$results = [];
$highlightId = isset($_GET['highlight']) ? trim((string)$_GET['highlight']) : '';

if (file_exists($dbPath)) {
    $content = file_get_contents($dbPath);
    $decoded = json_decode($content, true);
    if (is_array($decoded)) {
        $results = $decoded;
    }
}

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

// Sort all results dynamically by duration (completion time) ascending
usort($results, function($a, $b) {
    $timeA = parseDurationToSeconds(isset($a['duration']) ? $a['duration'] : '');
    $timeB = parseDurationToSeconds(isset($b['duration']) ? $b['duration'] : '');
    return $timeA - $timeB;
});

// Dynamically reassign ranks based on the sorted completion times
foreach ($results as $index => &$res) {
    $res['rank'] = $index + 1;
}
unset($res);

// Optional CSV Export triggered by GET query
if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=rapport_resistance_cubjac_' . date('Ymd_His') . '.csv');
    
    $output = fopen('php://output', 'w');
    // Write UTF-8 BOM for correct Excel encoding
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    fputcsv($output, ['Ordre / Rang', 'Temps de réalisation', 'Prénom', 'Nom de famille', 'Date d\'enregistrement']);
    foreach ($results as $res) {
        fputcsv($output, [
            $res['rank'],
            isset($res['duration']) ? $res['duration'] : 'N/A',
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
  <!-- Cache prevention meta tags -->
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>ARCHIVES CONFIDENTIELLES — PC CUBJAC 1944</title>
  
  <!-- Automatic cache-busting redirection to bypass aggressive edge caches -->
  <script>
    (function() {
      const urlParams = new URLSearchParams(window.location.search);
      const t = parseInt(urlParams.get('t'), 10);
      const now = Date.now();
      if (!t || (now - t) > 3000) {
        urlParams.set('t', now);
        window.location.replace(window.location.pathname + '?' + urlParams.toString());
      }
    })();
  </script>
  
  <!-- Google Fonts for authentic look -->
  <link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=VT323&display=swap" rel="stylesheet">
  
  <style>
    html {
      height: 100%;
      overflow: hidden;
      scrollbar-width: thin;
      scrollbar-color: #3A2A10 #000;
    }

    /* Reset and General terminal theme styling */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    /* Custom Webkit scrollbars to avoid OS scrollbar paint invalidation flickering */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #000;
    }
    ::-webkit-scrollbar-thumb {
      background: #3A2A10;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #B8A070;
    }
    
    body {
      background: #000;
      color: #B8A070;
      font-family: 'Special Elite', cursive;
      font-size: 1rem;
      line-height: 1.5;
      padding: 2.5rem 1rem;
      height: 100%;
      overflow-y: scroll;
      overflow-x: hidden;
      scrollbar-gutter: stable;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      position: relative;
    }

    /* Film grain CRT overlay animation - Fixed relative to viewport to avoid scrollbar repaint collisions */
    html::before {
      content: '';
      position: fixed; inset: 0;
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
    
    /* Highlighted Mission Duration style */
    .duration-cell {
      font-weight: bold;
      font-family: 'VT323', monospace;
      font-size: 1.45rem;
      color: #000 !important; /* Black text */
      background: #B8A070 !important; /* Theme-beige background */
      text-align: center;
      letter-spacing: 0.5px;
      border: 1px solid #111 !important;
      padding: 0.4rem 0.8rem;
      box-shadow: inset 0 0 5px rgba(0,0,0,0.55);
    }
    
    /* Highlighted row styling for the user's own score */
    .my-score-row {
      background: rgba(184, 160, 112, 0.15) !important;
      border: 1px solid #B8A070 !important;
      animation: pulse-highlight 2.5s infinite ease-in-out;
    }
    
    @keyframes pulse-highlight {
      0% { box-shadow: 0 0 4px rgba(184, 160, 112, 0.2); }
      50% { box-shadow: 0 0 12px rgba(184, 160, 112, 0.5); }
      100% { box-shadow: 0 0 4px rgba(184, 160, 112, 0.2); }
    }
    
    .vous-marker {
      font-size: 0.75rem;
      color: #FFD700;
      margin-left: 6px;
      vertical-align: middle;
      font-family: 'Special Elite', cursive;
      letter-spacing: 0;
      text-shadow: 0 0 3px rgba(255, 215, 0, 0.4);
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

    /* Custom Cursor Styles */
    html, body, *, *::before, *::after,
    button, input, select, textarea, a, .btn-action, .btn-back, [onclick] {
      cursor: none !important;
    }
    
    #custom-cursor {
      position: fixed;
      width: 20px;
      height: 20px;
      pointer-events: none;
      z-index: 999999 !important;
      transform: translate(-50%, -50%);
      transition: transform 0.08s ease-out;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #custom-cursor::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid #D4820A;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.8), inset 0 0 2px rgba(0, 0, 0, 0.6), 0 0 8px rgba(212, 130, 10, 0.5);
      transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.2s, box-shadow 0.2s;
    }

    #custom-cursor::after {
      content: '';
      position: absolute;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background-color: #C0392B;
      box-shadow: 0 0 3px rgba(0, 0, 0, 0.8), 0 0 6px rgba(192, 57, 43, 0.8);
      transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), background-color 0.2s, box-shadow 0.2s;
    }

    #custom-cursor.hover::before {
      transform: scale(1.4);
      border-color: #00FF88;
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.8), inset 0 0 3px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 255, 136, 0.8);
    }
    #custom-cursor.hover::after {
      transform: scale(0.6);
      background-color: #00FF88;
      box-shadow: 0 0 8px rgba(0, 255, 136, 0.9);
    }

    #custom-cursor.active::before {
      transform: scale(0.7);
      border-color: #FFB830;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.8), 0 0 10px rgba(255, 184, 48, 0.8);
    }
    #custom-cursor.active::after {
      transform: scale(1.6);
      background-color: #FFB830;
      box-shadow: 0 0 12px rgba(255, 184, 48, 0.9);
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
            <th style="width: 10%;">Ordre</th>
            <th style="width: 20%;">Durée de mission</th>
            <th style="width: 20%;">Prénom</th>
            <th style="width: 20%;">Nom</th>
            <th style="width: 30%;">Heure d'Enregistrement</th>
          </tr>
        </thead>
        <tbody>
          <?php if ($totalAgents > 0): ?>
            <?php foreach ($results as $res): ?>
              <?php 
                $isMyScore = (!empty($highlightId) && isset($res['id']) && $res['id'] === $highlightId);
                $rowClass = 'agent-row' . ($isMyScore ? ' my-score-row' : '');
              ?>
              <tr class="<?= $rowClass ?>" <?= $isMyScore ? 'id="my-score-marker"' : '' ?>>
                <td class="rank-cell">
                  #<?= sprintf('%02d', $res['rank']) ?>
                  <?php if ($isMyScore): ?>
                    <span class="vous-marker">(VOUS)</span>
                  <?php endif; ?>
                </td>
                <td class="duration-cell"><?= htmlspecialchars(isset($res['duration']) && $res['duration'] !== '' ? $res['duration'] : '—', ENT_QUOTES, 'UTF-8') ?></td>
                <td class="firstname-cell"><?= htmlspecialchars($res['firstname'], ENT_QUOTES, 'UTF-8') ?></td>
                <td class="lastname-cell"><?= htmlspecialchars($res['lastname'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars($res['timestamp'], ENT_QUOTES, 'UTF-8') ?></td>
              </tr>
            <?php endforeach; ?>
          <?php else: ?>
            <tr id="empty-row">
              <td colspan="5" class="no-results">
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
            <td colspan="5" class="no-results" style="color: #B8A070;">
              ❌ Aucun résistant ne correspond à votre recherche.
            </td>
          `;
          table.querySelector('tbody').appendChild(emptySearchRow);
        }
      } else if (emptySearchRow) {
        emptySearchRow.remove();
      }
    }
    
    // Auto-scroll to my-score-marker row smoothly when the page loads
    window.addEventListener('DOMContentLoaded', () => {
      const marker = document.getElementById('my-score-marker');
      if (marker) {
        setTimeout(() => {
          marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    });
  </script>

  <!-- Curseur custom -->
  <div id="custom-cursor"></div>
  
  <script>
    (function() {
      const cursor = document.getElementById('custom-cursor');
      if (!cursor) return;
      
      document.addEventListener('mousemove', e => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top  = e.clientY + 'px';
      });

      document.addEventListener('mousedown', () => {
        cursor.classList.add('active');
      });
      document.addEventListener('mouseup', () => {
        cursor.classList.remove('active');
      });
      
      document.addEventListener('mouseover', e => {
        const target = e.target;
        if (!target) return;
        const isInteractive = target.closest('button, input, select, textarea, a, .btn-action, .btn-back, [onclick]');
        if (isInteractive) {
          cursor.classList.add('hover');
        } else {
          cursor.classList.remove('hover');
        }
      });
      document.addEventListener('mouseout', e => {
        if (!e.relatedTarget) {
          cursor.classList.remove('hover');
        }
      });
    })();
  </script>
</body>
</html>
