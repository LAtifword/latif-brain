/**
 * LATIF GX Enterprise UI Framework
 * Core components for dashboard interactivity
 */

const UIFramework = (() => {
  const state = {
    currentSection: 'chat',
    isMenuOpen: false,
    expandedAgents: {},
    expandedWorkflows: {}
  };

  // Section switching
  const switchSection = (sectionName) => {
    const sections = document.querySelectorAll('[data-section-id]');
    const navItems = document.querySelectorAll('[data-section]');

    sections.forEach(sec => {
      sec.style.display = sec.getAttribute('data-section-id') === sectionName ? 'flex' : 'none';
    });

    navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-section') === sectionName);
    });

    state.currentSection = sectionName;
  };

  // Navigation setup
  const setupNavigation = () => {
    const navItems = document.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        switchSection(section);
      });
    });
  };

  // Dropdown menus
  const setupDropdowns = () => {
    const dropdowns = document.querySelectorAll('.dropdown-toggle');
    dropdowns.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = toggle.nextElementSibling;
        if (menu && menu.classList.contains('dropdown-menu')) {
          menu.classList.toggle('show');
        }
      });
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        menu.classList.remove('show');
      });
    });
  };

  // Form handling
  const setupForms = () => {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        triggerEvent('form-submit', { form: form.id, data });
      });
    });
  };

  // Button handling
  const setupButtons = () => {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        if (action) {
          e.preventDefault();
          triggerEvent('button-click', { action, button: btn });
        }
      });
    });
  };

  // Modal handling
  const showModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
    }
  };

  const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  const setupModals = () => {
    document.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) closeModal(modal.id);
      });
    });

    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
    });
  };

  // Event system
  const listeners = {};

  const on = (event, callback) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  };

  const off = (event, callback) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
  };

  const triggerEvent = (event, data) => {
    if (listeners[event]) {
      listeners[event].forEach(callback => callback(data));
    }
  };

  // Toast notifications
  const showNotification = (message, type = 'info', duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background: ${getColorForType(type)};
      color: white;
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  };

  const getColorForType = (type) => {
    const colors = {
      info: '#4a90e2',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336'
    };
    return colors[type] || colors.info;
  };

  // Table/List utilities
  const updateList = (containerId, items, renderFn) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map(renderFn).join('');
  };

  // Chart utilities (stub for future integration)
  const createChart = (canvasId, config) => {
    console.log('Chart requested for', canvasId, config);
  };

  // Loading state
  const setLoading = (elementId, isLoading) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (isLoading) {
      el.style.opacity = '0.6';
      el.style.pointerEvents = 'none';
    } else {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    }
  };

  // Initialize all components
  const init = () => {
    setupNavigation();
    setupDropdowns();
    setupForms();
    setupButtons();
    setupModals();

    const sections = document.querySelectorAll('[data-section-id]');
    sections.forEach(sec => {
      if (sec.getAttribute('data-section-id') !== 'chat') {
        sec.style.display = 'none';
      }
    });
  };

  return {
    switchSection,
    showModal,
    closeModal,
    showNotification,
    updateList,
    createChart,
    setLoading,
    on,
    off,
    triggerEvent,
    init,
    state: () => ({ ...state })
  };
})();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => UIFramework.init());
} else {
  UIFramework.init();
}
