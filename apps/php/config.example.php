<?php
return [
    // Must be outside the public document root and outside cloud-synchronized folders.
    'data_dir' => getenv('STORYTRACKS_DATA_DIR') ?: dirname(__DIR__) . '/storytracks-data',
    // Generate using: php -r "echo password_hash(readline('Password: '), PASSWORD_DEFAULT), PHP_EOL;"
    'password_hash' => getenv('STORYTRACKS_PASSWORD_HASH') ?: '',
];
