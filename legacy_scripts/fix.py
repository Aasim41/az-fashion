import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

modals = ['inquiryModal', 'productDetailsModal', 'requestsModal', 'orderConfirmationModal', 'accountModal']
for m in modals:
    bad_btn = '<button class=\"close-btn magnetic\"><i class=\"fas fa-arrow-left\"></i> Back</button>'
    good_btn = f'<button class=\"close-btn magnetic\" onclick=\"document.getElementById(\'{m}\').classList.remove(\'active\')\"><i class=\"fas fa-arrow-left\"></i> Back</button>'
    
    idx = html.find(f'id=\"{m}\"')
    if idx != -1:
        btn_idx = html.find(bad_btn, idx)
        if btn_idx != -1 and btn_idx < idx + 2000:
            html = html[:btn_idx] + good_btn + html[btn_idx + len(bad_btn):]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
