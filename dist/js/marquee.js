  (function() {
    // Load marquee items dynamically from backend
    function renderMarqueeFallback(message) {
      const track = document.getElementById('marqueeTrack');
      if (!track) return;
      track.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'marquee-item';
      empty.textContent = message || 'Explore premium marketplace updates soon.';
      const dot = document.createElement('span');
      dot.className = 'dot';
      empty.appendChild(dot);
      
      // Add the message twice for seamless looping
      track.appendChild(empty.cloneNode(true));
      track.appendChild(empty.cloneNode(true));
      
      // Enable animation for fallback
      track.classList.remove('marquee-track--static');
    }

    async function loadMarquee() {
      const track = document.getElementById('marqueeTrack');
      if (!track) return;

      try {
        const res = await fetch('/api/marquee?limit=12');
        if (!res.ok) {
          console.warn('Failed to load marquee: HTTP', res.status, res.statusText);
          renderMarqueeFallback('No marquee updates available right now.');
          return;
        }

        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items.reverse() : [];

        if (items.length === 0) {
          renderMarqueeFallback('No updates available right now.');
          return;
        }

        track.innerHTML = '';

        // Create marquee items twice for seamless looping animation
        const allItems = items.length > 0 ? [items, items].flat() : items;
        allItems.forEach(item => {
          const div = document.createElement('div');
          div.className = 'marquee-item';
          if (item.url) {
            const a = document.createElement('a');
            a.href = item.url;
            a.rel = 'noopener';
            a.textContent = item.text;
            div.appendChild(a);
          } else {
            div.textContent = item.text;
          }
          const dot = document.createElement('span');
          dot.className = 'dot';
          div.appendChild(dot);
          track.appendChild(div);
        });

        // Remove static class to enable animation
        track.classList.remove('marquee-track--static');
        
        // Ensure animation is properly triggered by forcing a reflow
        void track.offsetWidth;
      } catch (err) {
        console.warn('Failed to load marquee:', err && err.message ? err.message : err);
        renderMarqueeFallback('Unable to load marquee items.');
      }
    }

    // Initial load and periodic refresh
    loadMarquee();
    setInterval(loadMarquee, 1000 * 60 * 5); // refresh every 5 minutes
  })();