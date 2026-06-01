"use strict";
(() => {
  // src/index.ts
  var Select2Widget = class {
    constructor(container) {
      this.selectedValues = [];
      this.currentSuggestions = [];
      this.highlightedIndex = -1;
      this.searchTimeout = null;
      this.isOpen = false;
      this.container = container;
      const raw = container.getAttribute("data-config");
      if (!raw) {
        throw new Error("Select2Widget: \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 data-config");
      }
      this.config = JSON.parse(raw);
      this.selection = document.createElement("div");
      this.selection.className = "s2w-selection";
      this.searchInput = document.createElement("input");
      this.searchInput.type = "text";
      this.searchInput.className = "s2w-search";
      this.searchInput.placeholder = this.config.placeholder;
      this.searchInput.setAttribute("autocomplete", "off");
      this.searchInput.setAttribute("role", "combobox");
      this.searchInput.setAttribute("aria-autocomplete", "list");
      this.searchInput.setAttribute("aria-expanded", "false");
      this.selection.appendChild(this.searchInput);
      this.dropdown = document.createElement("div");
      this.dropdown.className = "s2w-dropdown";
      this.dropdown.setAttribute("role", "listbox");
      this.container.appendChild(this.selection);
      this.container.appendChild(this.dropdown);
      this.selectedValues = [...this.config.initialValue];
      this.renderTags();
      this.searchInput.addEventListener("input", this.onInput.bind(this));
      this.searchInput.addEventListener("keydown", this.onKeydown.bind(this));
      this.searchInput.addEventListener("focus", this.onFocus.bind(this));
      this.selection.addEventListener("click", this.onSelectionClick.bind(this));
      document.addEventListener("mousedown", this.onDocumentClick.bind(this));
    }
    /**
     * Клик по области selection — фокус на инпут
     */
    onSelectionClick(e) {
      const target = e.target;
      if (!target.classList.contains("s2w-tag-remove")) {
        this.searchInput.focus();
      }
    }
    onFocus() {
      this.selection.classList.add("s2w-selection--focused");
      this.searchInput.addEventListener("blur", this.onBlur.bind(this), { once: true });
    }
    onBlur() {
      this.selection.classList.remove("s2w-selection--focused");
    }
    /**
     * Клик вне виджета — закрыть дропдаун
     */
    onDocumentClick(e) {
      if (!this.container.contains(e.target)) {
        this.closeDropdown();
      }
    }
    // --- Поиск и дропдаун ---
    onInput() {
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
    async fetchSuggestions(query) {
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
        console.error("Select2Widget: \u043E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438:", error);
        this.displayResults([]);
      }
    }
    showLoading() {
      this.dropdown.innerHTML = '<div class="s2w-loading"><span class="s2w-spinner"></span></div>';
      this.openDropdown();
    }
    displayResults(results) {
      this.dropdown.innerHTML = "";
      this.highlightedIndex = -1;
      const filtered = results.filter((r) => !this.selectedValues.includes(r.text));
      this.currentSuggestions = filtered.map((r) => r.text);
      if (filtered.length > 0) {
        filtered.forEach((item, index) => {
          const el = document.createElement("div");
          el.className = "s2w-option";
          el.textContent = item.text;
          el.setAttribute("role", "option");
          el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            this.selectItem(item.text);
          });
          el.addEventListener("mouseenter", () => {
            this.highlightedIndex = index;
            this.updateHighlight();
          });
          this.dropdown.appendChild(el);
        });
      } else {
        const inputVal = this.searchInput.value.trim();
        if (inputVal) {
          const noRes = document.createElement("div");
          noRes.className = "s2w-no-results";
          noRes.textContent = `\u041D\u0435\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432. Enter \u2014 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \xAB${inputVal}\xBB`;
          noRes.addEventListener("mousedown", (e) => {
            e.preventDefault();
            this.addNewItem();
          });
          this.dropdown.appendChild(noRes);
        }
      }
      this.openDropdown();
    }
    openDropdown() {
      this.isOpen = true;
      this.dropdown.classList.add("s2w-dropdown--open");
      this.searchInput.setAttribute("aria-expanded", "true");
    }
    closeDropdown() {
      this.isOpen = false;
      this.dropdown.classList.remove("s2w-dropdown--open");
      this.dropdown.innerHTML = "";
      this.highlightedIndex = -1;
      this.currentSuggestions = [];
      this.searchInput.setAttribute("aria-expanded", "false");
    }
    // --- Навигация клавиатурой ---
    onKeydown(e) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (this.isOpen && this.currentSuggestions.length > 0) {
            this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.currentSuggestions.length - 1);
            this.updateHighlight();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (this.isOpen && this.currentSuggestions.length > 0) {
            this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
            this.updateHighlight();
          }
          break;
        case "Enter":
          e.preventDefault();
          if (this.isOpen && this.highlightedIndex >= 0 && this.highlightedIndex < this.currentSuggestions.length) {
            this.selectItem(this.currentSuggestions[this.highlightedIndex]);
          } else {
            this.addNewItem();
          }
          break;
        case "Escape":
          e.preventDefault();
          this.closeDropdown();
          this.searchInput.blur();
          break;
        case "Backspace":
          if (this.searchInput.value === "" && this.selectedValues.length > 0) {
            this.removeItem(this.selectedValues[this.selectedValues.length - 1]);
          }
          break;
        case "Tab":
          this.closeDropdown();
          break;
      }
    }
    updateHighlight() {
      const options = this.dropdown.querySelectorAll(".s2w-option");
      options.forEach((el, i) => {
        el.classList.toggle("s2w-option--highlighted", i === this.highlightedIndex);
      });
      const active = this.dropdown.querySelector(".s2w-option--highlighted");
      if (active) {
        active.scrollIntoView({ block: "nearest" });
      }
    }
    // --- Управление выбранными элементами ---
    selectItem(text) {
      if (this.selectedValues.includes(text)) {
        this.highlightDuplicate(text);
        return;
      }
      this.selectedValues.push(text);
      this.renderTags();
      this.syncHiddenInputs();
      this.searchInput.value = "";
      this.closeDropdown();
      this.searchInput.focus();
    }
    addNewItem() {
      const text = this.searchInput.value.trim();
      if (!text) return;
      this.selectItem(text);
    }
    removeItem(text) {
      this.selectedValues = this.selectedValues.filter((v) => v !== text);
      this.renderTags();
      this.syncHiddenInputs();
      this.searchInput.focus();
    }
    highlightDuplicate(text) {
      const tags = this.selection.querySelectorAll(".s2w-tag");
      tags.forEach((tag) => {
        if (tag.getAttribute("data-value") === text) {
          tag.classList.add("s2w-tag--highlight");
          setTimeout(() => tag.classList.remove("s2w-tag--highlight"), 500);
        }
      });
    }
    // --- Рендер тегов ---
    renderTags() {
      const existing = this.selection.querySelectorAll(".s2w-tag");
      existing.forEach((el) => el.remove());
      this.selectedValues.forEach((value) => {
        const tag = document.createElement("span");
        tag.className = "s2w-tag";
        tag.setAttribute("data-value", value);
        tag.setAttribute("title", value);
        const label = document.createElement("span");
        label.className = "s2w-tag-label";
        label.textContent = value;
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "s2w-tag-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.setAttribute("aria-label", `\u0423\u0434\u0430\u043B\u0438\u0442\u044C ${value}`);
        removeBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.removeItem(value);
        });
        tag.appendChild(label);
        tag.appendChild(removeBtn);
        this.selection.insertBefore(tag, this.searchInput);
      });
      this.searchInput.placeholder = this.selectedValues.length > 0 ? "" : this.config.placeholder;
    }
    // --- Синхронизация скрытых инпутов ---
    syncHiddenInputs() {
      const existing = this.container.querySelectorAll('input[type="hidden"]');
      existing.forEach((el) => el.remove());
      const empty = document.createElement("input");
      empty.type = "hidden";
      empty.name = this.config.inputName;
      empty.value = "";
      this.container.appendChild(empty);
      this.selectedValues.forEach((value) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = this.config.inputName;
        input.value = value;
        this.container.appendChild(input);
      });
    }
  };
  function initSelect2Widgets() {
    document.querySelectorAll(".s2w[data-config]").forEach((el) => {
      if (!el.hasAttribute("data-s2w-initialized")) {
        el.setAttribute("data-s2w-initialized", "1");
        new Select2Widget(el);
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSelect2Widgets);
  } else {
    initSelect2Widgets();
  }
})();
//# sourceMappingURL=select2widget.js.map
