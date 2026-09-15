<?php
declare(strict_types=1);

// Compatibility entrypoint: production web-server PHP routing accepts simple
// alphabetic API filenames. Keep the V2.6.2 implementation in one place and
// execute it through this stable PHP entrypoint.
require __DIR__ . '/admin-v262.php';
