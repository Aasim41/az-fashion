const fs = require('fs');
let code = fs.readFileSync('frontend/main.js', 'utf8');

// 1. Update checkout items list render
// Find where req.status === 'available' is handled in checkoutItemsList rendering
const oldAvailableHtml = `          <div style="font-weight: bold; color: var(--gold); margin-top: 5px;">Approved - Ready to Checkout</div>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 10px; cursor: pointer;">
            <input type="checkbox" class="req-checkout-cb" value="\${req.id}" data-price="\${req.price}" checked>
            <span>Pay for this item</span>
          </label>`;

const newAvailableHtml = `          <div style="font-weight: bold; color: var(--gold); margin-top: 5px;">Approved - Ready to Checkout</div>
          <div style="font-size: 0.8rem; color: #ff4d4d; margin-top: 2px; font-weight: bold;">
            <i class="fas fa-exclamation-circle"></i> Valid for 24 hours only. Please complete payment.
          </div>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 10px; cursor: pointer;">
            <input type="checkbox" class="req-checkout-cb" value="\${req.id}" data-price="\${req.price}" checked>
            <span>Pay for this item</span>
          </label>`;

code = code.replace(oldAvailableHtml, newAvailableHtml);

// 2. Update real-time notification toast text
const oldNotifyStr = "Your exclusive piece is now available for checkout.";
const newNotifyStr = "Your exclusive piece is approved. Please complete payment within 24 hours before it expires.";
code = code.replace(oldNotifyStr, newNotifyStr);

fs.writeFileSync('frontend/main.js', code);
