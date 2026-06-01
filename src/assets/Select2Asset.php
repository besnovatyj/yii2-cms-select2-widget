<?php


/*
 * Copyright (c) 2026 Besnovatyj. Licensed under the MIT License.
 */

declare(strict_types=1);

namespace Besnovatyj\Select2\assets;

use yii\web\AssetBundle;

/**
 * Бандл ресурсов для Select2Widget
 */
class Select2Asset extends AssetBundle
{
    public $sourcePath = __DIR__ . '/media/js/dist';

    public $js = [
        'select2widget.js',
    ];

    public $css = [
        'select2widget.css',
    ];
}
