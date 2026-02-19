document.addEventListener('DOMContentLoaded', () => {
  // Simple Tab Switching Logic
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      console.log(`Switched to: ${tab.textContent}`);
    });
  });

  // Search Interaction Simulation
  const heroSearchInput = document.querySelector('.hero-search input');
  const heroSearchBtn = document.querySelector('.hero-search button');

  if (heroSearchBtn) {
    heroSearchBtn.addEventListener('click', () => {
      const query = heroSearchInput.value;
      if (query) {
        alert(`Searching for: ${query}\n(This is a demonstration of the search interface.)`);
      }
    });
  }

  // Smooth Scroll for links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
});
