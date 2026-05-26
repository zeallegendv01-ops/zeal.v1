  (function() {
    const badge = document.getElementById('heritageBadge');
    if (badge) {
      const establishedYear = 2026;
      const now = new Date();
      const years = Math.max(1, now.getFullYear() - establishedYear + 1);
      const label = years === 1 ? 'Year of Heritage' : 'Years of Heritage';

      badge.textContent = `${years}+`;
      const span = document.createElement('span');
      span.textContent = label;
      badge.appendChild(span);
    }

    const copyright = document.getElementById('footerCopyright');
    if (copyright) {
      copyright.innerHTML = `&copy; ${new Date().getFullYear()} 365extra Heritage. All rights reserved.`;
    }
  })();