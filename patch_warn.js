const fs = require('fs');

let main = fs.readFileSync('frontend/main.js', 'utf8');

// 1. Add warning to Toast
main = main.replace(
  "body.innerText = `Great news! Your request for \"${req.product_name}\" is approved & ready for checkout.`;",
  "body.innerHTML = `Great news! Your request for \"${req.product_name}\" is approved & ready for checkout.<br><strong style=\"color:#ff4d4d; font-size:0.9em;\">⚠️ Valid for 24 hours only</strong>`;"
);

// 2. Add warning to Native Web Notification
main = main.replace(
  "body: `Your request for \"${req.product_name}\" has been approved! Tap to checkout.`",
  "body: `Your request for \"${req.product_name}\" has been approved! ⚠️ Valid for 24 hours only. Tap to checkout.`"
);

fs.writeFileSync('frontend/main.js', main);
console.log("main.js patched with 24hr warning");

// Let's also check admin WhatsApp template just in case
let admin = fs.readFileSync('frontend/admin.js', 'utf8');
if (admin.includes("has been APPROVED and is reserved for you.")) {
  admin = admin.replace(
    "has been APPROVED and is reserved for you.\\n\\nPlease visit",
    "has been APPROVED and is reserved for you.\\n⚠️ Note: This reservation is valid for 24 hours only.\\n\\nPlease visit"
  );
  fs.writeFileSync('frontend/admin.js', admin);
  console.log("admin.js WhatsApp template patched");
}
