<?php
// Приём заявок: проверка, антиспам, отправка на email и/или в Telegram.
// Успех возвращается только если заявка реально доставлена хотя бы одним каналом.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function out($code, $ok, $error = null) {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, false, 'Метод не поддерживается');

$cfgFile = __DIR__ . '/config.php';
if (!is_file($cfgFile)) out(503, false, 'Приём заявок ещё не настроен. Позвоните нам.');
$cfg = require $cfgFile;

// honeypot и время заполнения
if (!empty($_POST['website'])) out(200, true); // бот: делаем вид, что всё хорошо, но не отправляем
$ts = (int)($_POST['ts'] ?? 0);
if ($ts && (time() - intdiv($ts, 1000)) < ($cfg['min_seconds'] ?? 3)) out(429, false, 'Слишком быстро. Попробуйте ещё раз.');

// лимит по IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$rl = sys_get_temp_dir() . '/kf_rl_' . md5($ip);
if (is_file($rl) && (time() - filemtime($rl)) < ($cfg['rate_seconds'] ?? 30)) out(429, false, 'Заявка уже отправлена. Подождите немного.');

$clean = function ($v, $max) {
    $v = trim((string)$v);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v);
    return mb_substr($v, 0, $max);
};
$name    = $clean($_POST['name'] ?? '', 80);
$phone   = $clean($_POST['phone'] ?? '', 20);
$contact = $clean($_POST['contact'] ?? '', 30);
$comment = $clean($_POST['comment'] ?? '', 1000);
$subject = $clean($_POST['subject'] ?? 'Заявка с сайта', 150);
$context = $clean($_POST['context'] ?? '', 3000);
$page    = $clean($_POST['page'] ?? '', 300);

if (mb_strlen($name) < 2) out(422, false, 'Укажите имя');
if (!preg_match('/^\+7\d{10}$/', $phone)) out(422, false, 'Некорректный номер телефона');
if (empty($_POST['consent'])) out(422, false, 'Нужно согласие на обработку персональных данных');

$text = "Новая заявка: $subject\n\nИмя: $name\nТелефон: $phone\nСвязь: $contact\n";
if ($comment !== '') $text .= "Комментарий: $comment\n";
if ($context !== '') $text .= "\n$context\n";
$text .= "\nСтраница: $page\nIP: $ip\nВремя: " . date('d.m.Y H:i:s');

$sent = false;

if (!empty($cfg['mail_to'])) {
    $hdr = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    if (!empty($cfg['mail_from'])) $hdr .= 'From: ' . $cfg['mail_from'] . "\r\n";
    $subj = '=?UTF-8?B?' . base64_encode('КОМФОРТЕК: ' . str_replace(["\r", "\n"], ' ', $subject)) . '?=';
    if (@mail($cfg['mail_to'], $subj, $text, $hdr)) $sent = true;
}
if (!empty($cfg['tg_token']) && !empty($cfg['tg_chat'])) {
    $ch = curl_init('https://api.telegram.org/bot' . $cfg['tg_token'] . '/sendMessage');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
        CURLOPT_POSTFIELDS => ['chat_id' => $cfg['tg_chat'], 'text' => $text]]);
    $res = curl_exec($ch);
    $j = json_decode((string)$res, true);
    if ($j && !empty($j['ok'])) $sent = true;
    curl_close($ch);
}

if (!$sent) out(502, false, 'Не удалось доставить заявку. Позвоните нам.');
@touch($rl);
out(200, true);
