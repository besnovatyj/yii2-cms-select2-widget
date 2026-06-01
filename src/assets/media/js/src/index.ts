/*
 * Copyright (c) 2026 Besnovatyj. Licensed under the MIT License.
 */

/**
 * Select2Widget — компактный tag-input с серверным поиском.
 *
 * Инициализируется автоматически на всех элементах `.s2w[data-config]`.
 * Конфигурация передаётся через `data-config` (JSON).
 */

interface S2WConfig {
    endpoint: string;
    headers: Record<string, string>;
    initialValue: string[];
    inputName: string;
    placeholder: string;
}

interface S2WResult {
    text: string;
}

class Select2Widget {
    private readonly container: HTMLElement;
    private readonly config: S2WConfig;

    private readonly selection: HTMLElement;
    private readonly searchInput: HTMLInputElement;
    private readonly dropdown: HTMLElement;

    private selectedValues: string[] = [];
    private currentSuggestions: string[] = [];
    private highlightedIndex: number = -1;
    private searchTimeout: number | null = null;
    private isOpen: boolean = false;

    constructor(container: HTMLElement) {
        this.container = container;

        const raw = container.getAttribute('data-config');
        if (!raw) {
            throw new Error('Select2Widget: отсутствует data-config');
        }
        this.config = JSON.parse(raw);

        // Строим DOM
        this.selection = document.createElement('div');
        this.selection.className = 's2w-selection';

        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 's2w-search';
        this.searchInput.placeholder = this.config.placeholder;
        this.searchInput.setAttribute('autocomplete', 'off');
        this.searchInput.setAttribute('role', 'combobox');
        this.searchInput.setAttribute('aria-autocomplete', 'list');
        this.searchInput.setAttribute('aria-expanded', 'false');

        this.selection.appendChild(this.searchInput);

        this.dropdown = document.createElement('div');
        this.dropdown.className = 's2w-dropdown';
        this.dropdown.setAttribute('role', 'listbox');

        this.container.appendChild(this.selection);
        this.container.appendChild(this.dropdown);

        // Загрузка начальных значений
        this.selectedValues = [...this.config.initialValue];
        this.renderTags();

        // Привязка событий
        this.searchInput.addEventListener('input', this.onInput.bind(this));
        this.searchInput.addEventListener('keydown', this.onKeydown.bind(this));
        this.searchInput.addEventListener('focus', this.onFocus.bind(this));
        this.selection.addEventListener('click', this.onSelectionClick.bind(this));
        document.addEventListener('mousedown', this.onDocumentClick.bind(this));
    }

    /**
     * Клик по области selection — фокус на инпут
     */
    private onSelectionClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('s2w-tag-remove')) {
            this.searchInput.focus();
        }
    }

    private onFocus(): void {
        this.selection.classList.add('s2w-selection--focused');
        this.searchInput.addEventListener('blur', this.onBlur.bind(this), { once: true });
    }

    private onBlur(): void {
        this.selection.classList.remove('s2w-selection--focused');
    }

    /**
     * Клик вне виджета — закрыть дропдаун
     */
    private onDocumentClick(e: MouseEvent): void {
        if (!this.container.contains(e.target as Node)) {
            this.closeDropdown();
        }
    }

    // --- Поиск и дропдаун ---

    private onInput(): void {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        const query = this.searchInput.value.trim();
        if (query.length > 0) {
            this.searchTimeout = window.setTimeout(() => {
                this.fetchSuggestions(query);
            }, 300);
        } else {
            this.closeDropdown();
        }
    }

    private async fetchSuggestions(query: string): Promise<void> {
        this.showLoading();
        try {
            const response = await fetch(
                `${this.config.endpoint}?q=${encodeURIComponent(query)}`,
                { headers: this.config.headers }
            );
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            this.displayResults(data.results || []);
        } catch (error) {
            console.error('Select2Widget: ошибка загрузки:', error);
            this.displayResults([]);
        }
    }

    private showLoading(): void {
        this.dropdown.innerHTML = '<div class="s2w-loading"><span class="s2w-spinner"></span></div>';
        this.openDropdown();
    }

    private displayResults(results: S2WResult[]): void {
        this.dropdown.innerHTML = '';
        this.highlightedIndex = -1;

        // Фильтруем уже выбранные
        const filtered = results.filter(r => !this.selectedValues.includes(r.text));
        this.currentSuggestions = filtered.map(r => r.text);

        if (filtered.length > 0) {
            filtered.forEach((item, index) => {
                const el = document.createElement('div');
                el.className = 's2w-option';
                el.textContent = item.text;
                el.setAttribute('role', 'option');
                el.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Предотвращаем потерю фокуса
                    this.selectItem(item.text);
                });
                el.addEventListener('mouseenter', () => {
                    this.highlightedIndex = index;
                    this.updateHighlight();
                });
                this.dropdown.appendChild(el);
            });
        } else {
            const inputVal = this.searchInput.value.trim();
            if (inputVal) {
                const noRes = document.createElement('div');
                noRes.className = 's2w-no-results';
                noRes.textContent = `Нет результатов. Enter — добавить «${inputVal}»`;
                noRes.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.addNewItem();
                });
                this.dropdown.appendChild(noRes);
            }
        }

        this.openDropdown();
    }

    private openDropdown(): void {
        this.isOpen = true;
        this.dropdown.classList.add('s2w-dropdown--open');
        this.searchInput.setAttribute('aria-expanded', 'true');
    }

    private closeDropdown(): void {
        this.isOpen = false;
        this.dropdown.classList.remove('s2w-dropdown--open');
        this.dropdown.innerHTML = '';
        this.highlightedIndex = -1;
        this.currentSuggestions = [];
        this.searchInput.setAttribute('aria-expanded', 'false');
    }

    // --- Навигация клавиатурой ---

    private onKeydown(e: KeyboardEvent): void {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (this.isOpen && this.currentSuggestions.length > 0) {
                    this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.currentSuggestions.length - 1);
                    this.updateHighlight();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (this.isOpen && this.currentSuggestions.length > 0) {
                    this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
                    this.updateHighlight();
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (this.isOpen && this.highlightedIndex >= 0 && this.highlightedIndex < this.currentSuggestions.length) {
                    this.selectItem(this.currentSuggestions[this.highlightedIndex]);
                } else {
                    this.addNewItem();
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.closeDropdown();
                this.searchInput.blur();
                break;

            case 'Backspace':
                if (this.searchInput.value === '' && this.selectedValues.length > 0) {
                    this.removeItem(this.selectedValues[this.selectedValues.length - 1]);
                }
                break;

            case 'Tab':
                this.closeDropdown();
                break;
        }
    }

    private updateHighlight(): void {
        const options = this.dropdown.querySelectorAll('.s2w-option');
        options.forEach((el, i) => {
            el.classList.toggle('s2w-option--highlighted', i === this.highlightedIndex);
        });
        const active = this.dropdown.querySelector('.s2w-option--highlighted');
        if (active) {
            active.scrollIntoView({ block: 'nearest' });
        }
    }

    // --- Управление выбранными элементами ---

    private selectItem(text: string): void {
        if (this.selectedValues.includes(text)) {
            this.highlightDuplicate(text);
            return;
        }
        this.selectedValues.push(text);
        this.renderTags();
        this.syncHiddenInputs();
        this.searchInput.value = '';
        this.closeDropdown();
        this.searchInput.focus();
    }

    private addNewItem(): void {
        const text = this.searchInput.value.trim();
        if (!text) return;
        this.selectItem(text);
    }

    private removeItem(text: string): void {
        this.selectedValues = this.selectedValues.filter(v => v !== text);
        this.renderTags();
        this.syncHiddenInputs();
        this.searchInput.focus();
    }

    private highlightDuplicate(text: string): void {
        const tags = this.selection.querySelectorAll('.s2w-tag');
        tags.forEach(tag => {
            if (tag.getAttribute('data-value') === text) {
                tag.classList.add('s2w-tag--highlight');
                setTimeout(() => tag.classList.remove('s2w-tag--highlight'), 500);
            }
        });
    }

    // --- Рендер тегов ---

    private renderTags(): void {
        // Удаляем старые теги (всё кроме инпута)
        const existing = this.selection.querySelectorAll('.s2w-tag');
        existing.forEach(el => el.remove());

        // Вставляем теги перед инпутом
        this.selectedValues.forEach(value => {
            const tag = document.createElement('span');
            tag.className = 's2w-tag';
            tag.setAttribute('data-value', value);
            tag.setAttribute('title', value);

            const label = document.createElement('span');
            label.className = 's2w-tag-label';
            label.textContent = value;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 's2w-tag-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `Удалить ${value}`);
            removeBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeItem(value);
            });

            tag.appendChild(label);
            tag.appendChild(removeBtn);
            this.selection.insertBefore(tag, this.searchInput);
        });

        // Обновляем плейсхолдер
        this.searchInput.placeholder = this.selectedValues.length > 0 ? '' : this.config.placeholder;
    }

    // --- Синхронизация скрытых инпутов ---

    private syncHiddenInputs(): void {
        // Удаляем все скрытые инпуты
        const existing = this.container.querySelectorAll('input[type="hidden"]');
        existing.forEach(el => el.remove());

        // Пустой input гарантирует отправку ключа на сервер даже без выбранных значений
        const empty = document.createElement('input');
        empty.type = 'hidden';
        empty.name = this.config.inputName;
        empty.value = '';
        this.container.appendChild(empty);

        // Создаём инпуты для выбранных значений
        this.selectedValues.forEach(value => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = this.config.inputName;
            input.value = value;
            this.container.appendChild(input);
        });
    }
}

// --- Автоинициализация ---
function initSelect2Widgets(): void {
    document.querySelectorAll<HTMLElement>('.s2w[data-config]').forEach(el => {
        if (!el.hasAttribute('data-s2w-initialized')) {
            el.setAttribute('data-s2w-initialized', '1');
            new Select2Widget(el);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSelect2Widgets);
} else {
    initSelect2Widgets();
}
