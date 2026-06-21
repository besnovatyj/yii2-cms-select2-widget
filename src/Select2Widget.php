<?php


/*
 * Copyright (c) 2026 Besnovatyj. Licensed under the MIT License.
 */

declare(strict_types=1);

namespace Besnovatyj\Select2;

use Besnovatyj\Select2\assets\Select2Asset;
use Yii;
use yii\base\InvalidConfigException;
use yii\bootstrap5\InputWidget;
use yii\helpers\Html;
use yii\helpers\Json;

/**
 * Select2Widget — виджет множественного выбора с серверным поиском.
 *
 * Отображает поле ввода с тегами выбранных значений внутри,
 * выпадающий список подсказок с сервера и возможность добавления новых значений.
 *
 * Пример использования:
 * ```php
 * $form->field($model, 'tags')->widget(Select2Widget::class, [
 *     'endpoint' => Url::to(['/blog/tag/search-endpoint']),
 * ]);
 * ```
 *
 * Формат ответа сервера: `{"results": [{"text": "значение"}, ...]}`
 */
class Select2Widget extends InputWidget
{
    /** @var string URL эндпоинта для серверного поиска */
    public string $endpoint = '';

    /** @var string Текст плейсхолдера */
    public string $placeholder = 'Введите для поиска...';

    /**
     * @throws InvalidConfigException
     */
    public function run(): string
    {
        if ($this->endpoint === '') {
            throw new InvalidConfigException('Свойство "endpoint" должно быть задано.');
        }

        $initialData = $this->getInitialData();
        $inputName = Html::getInputName($this->model, $this->attribute) . '[]';
        $widgetId = $this->options['id'];

        $config = Json::encode([
            'endpoint' => $this->endpoint,
            'headers' => [
                'x-csrf-token' => Yii::$app->request->getCsrfToken(),
                'X-Requested-With' => 'XMLHttpRequest',
            ],
            'initialValue' => $initialData,
            'inputName' => $inputName,
            'placeholder' => $this->placeholder,
        ]);

        Select2Asset::register($this->view);

        // Пустой hidden input гарантирует отправку ключа даже без выбранных значений
        $hiddenInputs = Html::hiddenInput($inputName, '');
        foreach ($initialData as $value) {
            $hiddenInputs .= Html::hiddenInput($inputName, $value);
        }

        // Рендер контейнера виджета
        return Html::tag('div', $hiddenInputs, [
            'id' => $widgetId,
            'class' => 's2w',
            'data-config' => $config,
        ]);
    }

    /**
     * Извлекает начальные данные из атрибута модели
     *
     * @return string[]
     */
    private function getInitialData(): array
    {
        $attribute = $this->attribute;
        $value = $this->model->$attribute;

        // Если это массив, фильтруем только строки
        if (is_array($value) && !empty($value)) {
            return array_values(array_filter($value, 'is_string'));
        }

        // Если это строка, пытаемся декодировать как JSON
        if (is_string($value)) {
            try {
                $decoded = Json::decode($value, true);
                if (is_array($decoded)) {
                    return array_values(array_filter($decoded, 'is_string'));
                }
            } catch (\Exception $e) {
                return [];
            }
        }

        return [];
    }
}
