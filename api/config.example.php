<?php
// Production Baota setup currently keeps this protected file at:
// /www/wwwroot/yanglao/.yanglao-db.php
// Nginx must deny public access to /.yanglao-db.php.
return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'yanglao',
    'db_user' => 'yanglao',
    'db_pass' => 'CHANGE_ME',
    // Used only for the private /admin/ dashboard. Choose your own strong password.
    'admin_password' => 'CHANGE_ME_TOO',
];
