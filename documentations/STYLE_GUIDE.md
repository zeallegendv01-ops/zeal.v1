# 365extra Design System - Style Guide for Developers

Professional reference guide for implementing components consistently.

---

## Table of Contents

1. [Principles](#principles)
2. [Color Usage](#color-usage)
3. [Typography Guidelines](#typography-guidelines)
4. [Component Patterns](#component-patterns)
5. [Layout Patterns](#layout-patterns)
6. [Interaction Patterns](#interaction-patterns)
7. [Accessibility Standards](#accessibility-standards)
8. [Code Examples](#code-examples)

---

## Principles

### Clean & Minimal
- Remove visual clutter
- Use whitespace strategically
- Show only necessary information
- Progressive disclosure for complex features

### Professional & Trustworthy
- Consistent design language
- Predictable interactions
- Clear visual hierarchy
- Attention to detail

### Accessible & Inclusive
- WCAG 2.1 Level AA compliant
- Keyboard navigable
- Screen reader friendly
- Color-blind safe palettes

### Performance First
- Optimized animations (60fps)
- Fast interactions (< 100ms)
- Minimal layout shifts
- Efficient CSS

---

## Color Usage

### Primary Actions
Always use `btn-primary` with gold gradient:

```html
<!-- Correct -->
<button class="btn btn-primary">Save Changes</button>
<button class="btn btn-primary">Add to Cart</button>
<button class="btn btn-primary">Subscribe Now</button>

<!-- Avoid -->
<button class="btn btn-secondary">Save Changes</button>
<button class="btn btn-dark">Subscribe Now</button>
```

### Secondary Actions
Use `btn-secondary` for less important actions:

```html
<!-- Correct -->
<div class="modal-footer">
  <button class="btn btn-secondary">Cancel</button>
  <button class="btn btn-primary">Confirm</button>
</div>

<!-- Avoid -->
<div class="modal-footer">
  <button class="btn btn-primary">Cancel</button>
  <button class="btn btn-primary">Confirm</button>
</div>
```

### Status Colors
Match action to color semantics:

```html
<!-- Success actions -->
<button class="btn btn-success">Approve</button>
<div class="alert alert-success">Order confirmed</div>

<!-- Warning states -->
<button class="btn btn-warning">Restore</button>
<div class="alert alert-warning">Limited stock remaining</div>

<!-- Destructive actions -->
<button class="btn btn-error">Delete</button>
<div class="alert alert-error">Payment failed</div>

<!-- Informational -->
<button class="btn btn-info">Learn More</button>
<div class="alert alert-info">New features available</div>
```

### Text Colors
Use semantic text colors:

```html
<!-- Primary text (normal) -->
<p>Regular content</p>

<!-- Secondary text (less important) -->
<p class="text-muted">Additional information</p>

<!-- Semantic colors -->
<p class="text-success">Completed successfully</p>
<p class="text-error">Something went wrong</p>
<p class="text-gold">Premium feature</p>

<!-- Avoid -->
<p style="color: #ff0000;">Don't use inline styles</p>
```

---

## Typography Guidelines

### Heading Hierarchy

**Rule**: Use headings sequentially (H1 → H2 → H3)

```html
<!-- Correct -->
<h1>Page Title</h1>
<section>
  <h2>Section Title</h2>
  <h3>Subsection</h3>
</section>

<!-- Avoid -->
<h1>Page Title</h1>
<h3>Subsection (skipped H2)</h3>

<!-- Avoid -->
<h1>Page Title</h1>
<h1>Another H1 (multiple primary headings)</h1>
```

### Line Length
Keep text readable:

```html
<!-- Correct: ~60-80 characters per line -->
<div style="max-width: 600px;">
  <p>This is comfortable to read because the line length is appropriate for body text...</p>
</div>

<!-- Avoid: Too long -->
<p>This line of text is far too long to read comfortably on a single line and will cause eye strain because it forces readers to move their heads back and forth to follow the content</p>
```

### Weight Consistency
Use semantic font weights:

```html
<!-- Labels: semibold (600) -->
<label class="form-label">Email Address</label>

<!-- Headings: bold (700) -->
<h1>Main Title</h1>

<!-- Body: normal (400) -->
<p>Regular paragraph text</p>

<!-- Captions: normal (400) -->
<small>Photo by John Doe</small>

<!-- Avoid -->
<p style="font-weight: 800;">Too heavy for body text</p>
<label style="font-weight: 300;">Too light for labels</label>
```

---

## Component Patterns

### Button Groups

Create related button sets with consistent spacing:

```html
<!-- Horizontal button group -->
<div style="display: flex; gap: var(--space-3);">
  <button class="btn btn-primary">Save</button>
  <button class="btn btn-secondary">Cancel</button>
  <button class="btn btn-secondary">Reset</button>
</div>

<!-- Vertical button group (mobile) -->
<div style="display: flex; flex-direction: column; gap: var(--space-3);">
  <button class="btn btn-primary btn-block">Save</button>
  <button class="btn btn-secondary btn-block">Cancel</button>
</div>
```

### Card Patterns

#### Product Card
```html
<div class="card">
  <div class="card-body">
    <img src="product.jpg" alt="Product Name" style="width: 100%; height: 200px; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-4);">
    <h4 style="margin: 0 0 var(--space-2) 0;">Premium Rice</h4>
    <p class="text-muted" style="margin: 0 0 var(--space-3) 0;">High-quality organic rice</p>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <span style="font-size: var(--text-lg); font-weight: 700; color: var(--primary-gold);">$45.00/kg</span>
      <span style="font-size: var(--text-sm); color: var(--text-tertiary);">In stock</span>
    </div>
    <button class="btn btn-primary btn-block">Add to Cart</button>
  </div>
</div>
```

#### Featured Card
```html
<div class="card card-highlight">
  <div class="card-header">
    <h3 style="margin: 0;">Featured Product</h3>
  </div>
  <div class="card-body">
    <p>This is a featured product card with premium gold border styling.</p>
  </div>
</div>
```

#### Stat Card
```html
<div class="card" style="text-align: center; padding: var(--space-8);">
  <p style="color: var(--text-tertiary); font-size: var(--text-sm); margin: 0 0 var(--space-2) 0; text-transform: uppercase; letter-spacing: 1px;">Total Orders</p>
  <h2 style="margin: 0; color: var(--primary-gold);">2,456</h2>
  <p style="color: var(--text-tertiary); font-size: var(--text-sm); margin: var(--space-2) 0 0 0;">Up 12% from last month</p>
</div>
```

### Form Patterns

#### Login Form
```html
<div class="card" style="max-width: 400px;">
  <div class="card-header">
    <h3 style="margin: 0;">Sign In</h3>
  </div>
  <form class="card-body">
    <div class="form-group">
      <label class="form-label required">Email Address</label>
      <input type="email" placeholder="you@example.com" required>
    </div>
    
    <div class="form-group">
      <label class="form-label required">Password</label>
      <input type="password" placeholder="Minimum 8 characters" required>
    </div>
    
    <button class="btn btn-primary btn-block">Sign In</button>
    
    <p style="text-align: center; margin-top: var(--space-4); color: var(--text-tertiary);">
      Don't have an account?
      <a href="#signup" style="color: var(--primary-gold); font-weight: 600;">Create one</a>
    </p>
  </form>
</div>
```

#### Search Form
```html
<form style="display: flex; gap: var(--space-2);">
  <div style="flex: 1;">
    <input type="search" placeholder="Search products..." style="width: 100%;">
  </div>
  <button type="submit" class="btn btn-primary">Search</button>
</form>
```

### Modal Patterns

#### Confirmation Modal
```html
<div id="confirmModal" class="modal-backdrop">
  <div class="modal-box" style="max-width: 400px;">
    <div class="modal-header">
      <h2 style="margin: 0;">Confirm Action</h2>
      <button class="modal-close" onclick="closeModal('confirmModal')">×</button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to delete this product? This action cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('confirmModal')">Cancel</button>
      <button class="btn btn-error" onclick="confirmDelete()">Delete</button>
    </div>
  </div>
</div>
```

#### Loading Modal
```html
<div id="loadingModal" class="modal-backdrop">
  <div class="modal-box" style="max-width: 300px;">
    <div class="modal-body" style="text-align: center; padding: var(--space-12);">
      <div class="btn loading" style="height: 40px; width: 40px; margin: 0 auto var(--space-4);"></div>
      <p style="margin: 0;">Processing your request...</p>
    </div>
  </div>
</div>
```

### Alert Patterns

#### Inline Validation Alert
```html
<div class="alert alert-error">
  <div class="alert-icon">!</div>
  <div class="alert-content">
    <div class="alert-title">Validation Error</div>
    <p class="alert-message">Please enter a valid email address</p>
  </div>
</div>
```

#### Toast Notification
```javascript
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.style.position = 'fixed';
  toast.style.bottom = 'var(--space-4)';
  toast.style.right = 'var(--space-4)';
  toast.style.maxWidth = '400px';
  toast.style.zIndex = '10000';
  toast.innerHTML = `
    <div class="alert-icon">${type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</div>
    <div class="alert-content">
      <p class="alert-message" style="margin: 0;">${message}</p>
    </div>
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

// Usage
showToast('Order placed successfully!', 'success');
showToast('An error occurred', 'error');
```

---

## Layout Patterns

### Hero Section
```html
<div style="background: linear-gradient(135deg, var(--primary-dark) 0%, rgba(13, 13, 11, 0.95) 100%); color: white; padding: var(--space-20) var(--space-8); text-align: center; border-radius: var(--radius-xl);">
  <h1 style="color: white; margin-bottom: var(--space-4);">Welcome to 365extra</h1>
  <p style="color: rgba(255, 255, 255, 0.85); max-width: 600px; margin: 0 auto var(--space-6);">Discover premium agricultural products from West Africa</p>
  <div style="display: flex; gap: var(--space-4); justify-content: center; flex-wrap: wrap;">
    <button class="btn btn-primary">Shop Now</button>
    <button class="btn btn-secondary">Learn More</button>
  </div>
</div>
```

### Two-Column Layout
```html
<div class="grid grid-2 gap-6">
  <div class="card">
    <div class="card-header">
      <h3 style="margin: 0;">Left Column</h3>
    </div>
    <div class="card-body">
      Content here
    </div>
  </div>
  
  <div class="card">
    <div class="card-header">
      <h3 style="margin: 0;">Right Column</h3>
    </div>
    <div class="card-body">
      Content here
    </div>
  </div>
</div>
```

### Sidebar Layout
```html
<div class="grid gap-6" style="grid-template-columns: 250px 1fr;">
  <!-- Sidebar -->
  <aside style="height: fit-content; position: sticky; top: 100px;">
    <nav style="display: flex; flex-direction: column; gap: var(--space-2);">
      <a href="#" style="padding: var(--space-3); border-radius: var(--radius-md); background: var(--primary-gold); color: var(--primary-dark); text-decoration: none; font-weight: 600;">Dashboard</a>
      <a href="#" style="padding: var(--space-3); border-radius: var(--radius-md); color: var(--text-primary); text-decoration: none; opacity: 0.7;">Orders</a>
      <a href="#" style="padding: var(--space-3); border-radius: var(--radius-md); color: var(--text-primary); text-decoration: none; opacity: 0.7;">Settings</a>
    </nav>
  </aside>
  
  <!-- Main Content -->
  <main>
    <div class="card">
      <div class="card-body">
        Main content here
      </div>
    </div>
  </main>
</div>
```

---

## Interaction Patterns

### Hover Effects
Subtle, professional interactions:

```css
/* Links - underline animation */
a {
  position: relative;
  text-decoration: none;
}

a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.3s var(--ease);
}

a:hover::after {
  width: 100%;
}

/* Cards - lift effect */
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Buttons - gradient shift */
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

### Focus States
Keyboard accessibility:

```css
/* All interactive elements */
*:focus-visible {
  outline: 2px solid var(--primary-gold);
  outline-offset: 2px;
}

button:focus-visible {
  outline-offset: 0;
}

input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--primary-gold);
  outline-offset: 0;
}
```

### Loading State
```html
<button class="btn btn-primary loading" disabled>Processing...</button>
```

---

## Accessibility Standards

### WCAG 2.1 Level AA Checklist

#### Color Contrast
- **Minimum**: 4.5:1 for normal text
- **Large text**: 3:1 minimum
- **Non-text**: 3:1 minimum

Test with: https://webaim.org/resources/contrastchecker/

#### Keyboard Navigation
```html
<!-- Tab order important -->
<input type="text" tabindex="1">
<input type="email" tabindex="2">
<button tabindex="3">Submit</button>

<!-- Skip to content link -->
<a href="#main-content" style="position: absolute; top: -40px; left: 0; padding: 8px;">Skip to main content</a>
<main id="main-content">
  <!-- Content here -->
</main>
```

#### Form Accessibility
```html
<!-- Always link labels to inputs -->
<div class="form-group">
  <label for="email" class="form-label">Email Address</label>
  <input id="email" type="email" aria-required="true">
</div>

<!-- Error messages linked to input -->
<div class="form-group">
  <label for="password">Password</label>
  <input id="password" type="password" aria-describedby="pwd-error">
  <p id="pwd-error" role="alert" style="color: var(--error);">Password must be at least 8 characters</p>
</div>
```

#### Screen Reader Support
```html
<!-- Descriptive alt text -->
<img src="product.jpg" alt="Organic rice variety - 25kg bag">

<!-- Hidden text for icons -->
<button>
  <i class="fas fa-times"></i>
  <span class="sr-only">Close</span>
</button>

<!-- Use aria-label for icon buttons -->
<button aria-label="Search products">
  <i class="fas fa-search"></i>
</button>

<!-- CSS for screen reader only -->
<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
```

---

## Code Examples

### Complete Login Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In - 365extra</title>
  <link rel="stylesheet" href="dist/css/modern-style.css">
</head>
<body>
  <nav>
    <a href="/" class="nav-brand">
      <span class="nav-brand-icon">AC</span>
      <span class="nav-brand-name">365extra</span>
    </a>
  </nav>

  <main style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--space-4);">
    <div class="card" style="width: 100%; max-width: 400px;">
      <div class="card-header">
        <h2 style="margin: 0;">Sign In</h2>
      </div>
      
      <form class="card-body" id="loginForm">
        <div class="form-group">
          <label for="email" class="form-label required">Email Address</label>
          <input id="email" type="email" placeholder="you@example.com" required>
        </div>
        
        <div class="form-group">
          <label for="password" class="form-label required">Password</label>
          <input id="password" type="password" placeholder="Minimum 8 characters" required>
        </div>
        
        <button type="submit" class="btn btn-primary btn-block">Sign In</button>
        
        <p style="text-align: center; margin-top: var(--space-4); color: var(--text-tertiary);">
          Don't have an account?
          <a href="/register" style="color: var(--primary-gold); font-weight: 600;">Create one</a>
        </p>
      </form>
    </div>
  </main>

  <script>
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
          window.location.href = '/dashboard';
        } else {
          showToast('Invalid credentials', 'error');
        }
      } catch (error) {
        showToast('An error occurred', 'error');
      }
    });
    
    function showToast(message, type) {
      // Toast implementation (see Interaction Patterns)
    }
  </script>
</body>
</html>
```

---

## Testing Checklist

- [ ] Responsive at 640px, 768px, 1024px, 1280px
- [ ] All interactive elements keyboard accessible
- [ ] Color contrast ≥ 4.5:1
- [ ] Forms work without JavaScript
- [ ] Modal closes on Escape key
- [ ] Links work with Enter key
- [ ] Buttons work with Space/Enter
- [ ] Screen reader announces content
- [ ] No layout shift during loading
- [ ] Images have alt text

---

## Resources

- **Colors**: WebAIM Contrast Checker
- **Typography**: Google Fonts, Font Pair
- **Icons**: Font Awesome 6.4+
- **Accessibility**: WCAG 2.1 Guidelines
- **Performance**: PageSpeed Insights
- **Browser Testing**: BrowserStack

---

Good practices make great products. Follow these guidelines for consistency and quality!


