/**
 * Tirvona - Ashram Lead Creative CRM & Workspace
 * Interactive JavaScript Application
 */

const STORAGE_KEY = 'tirvona_ashram_leads_v1';

// Initial Demo Leads Data
const DEFAULT_LEADS = [
  {
    id: 'lead-101',
    name: 'Acharya Swami Ramananda',
    phone: '+91 98712 34567',
    location: 'Rishikesh',
    type: 'Sadhana Stay',
    guests: 8,
    nights: 7,
    status: 'VIP Priority',
    needs: 'Private Ganga Facing Kuti',
    notes: 'Desires quiet meditation hut near Tapovan. Needs pure Satvic meal without onion/garlic and daily evening Veda chanting space.',
    createdAt: '2026-08-01'
  },
  {
    id: 'lead-102',
    name: 'Pandit Rajeshwar Sharma',
    phone: '+91 94150 99881',
    location: 'Varanasi',
    type: 'Group Yatra',
    guests: 25,
    nights: 4,
    status: 'Confirmed Stay',
    needs: 'Senior Citizen Care',
    notes: 'Kashi Yatra pilgrim group from Gujarat. 10 senior citizens need ground floor rooms close to Dashashwamedh Ghat.',
    createdAt: '2026-08-03'
  },
  {
    id: 'lead-103',
    name: 'Radha Devi & Family',
    phone: '+91 98290 11223',
    location: 'Vrindavan',
    type: 'Sadhana Stay',
    guests: 4,
    nights: 3,
    status: 'New Inquiry',
    needs: 'Wheelchair & Ground Floor',
    notes: 'Inquiring for Janmashtami week retreat. Requires double bedroom with AC & Satvic Prasadam booking.',
    createdAt: '2026-08-05'
  },
  {
    id: 'lead-104',
    name: 'Dr. Ananya Mukherji',
    phone: '+91 97480 55443',
    location: 'Haridwar',
    type: 'Corporate Retreat',
    guests: 18,
    nights: 2,
    status: 'Follow-Up Scheduled',
    needs: 'Standard AC Room',
    notes: 'Spiritual wellness & mindfulness weekend for IT executives. Requested yoga hall & Ganga Aarti arrangements.',
    createdAt: '2026-08-06'
  },
  {
    id: 'lead-105',
    name: 'Shri Vikramaditya Verma',
    phone: '+91 99100 88776',
    location: 'Ayodhya',
    type: 'Veda Pathshala',
    guests: 12,
    nights: 5,
    status: 'Confirmed Stay',
    needs: 'Satvic Dormitory',
    notes: 'Group of Vedic scholars visiting Ram Mandir. Need dormitory stay and early morning Brahma Muhurta hall access.',
    createdAt: '2026-08-07'
  }
];

class AshramLeadApp {
  constructor() {
    this.leads = this.loadLeads();
    this.searchQuery = '';
    this.selectedLocation = 'ALL';
    this.selectedType = 'ALL';
    this.commLang = 'HI';
    this.commTpl = 'welcome';
    this.charts = {};

    this.initElements();
    this.initEventListeners();
    this.render();
    this.initCharts();
  }

  loadLeads() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved leads:', e);
      }
    }
    return [...DEFAULT_LEADS];
  }

  saveLeads() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.leads));
  }

  calculateLeadScore(lead) {
    let score = 50;
    if (lead.guests >= 10) score += 20;
    else if (lead.guests >= 4) score += 10;

    if (lead.nights >= 5) score += 15;
    else if (lead.nights >= 3) score += 8;

    if (lead.status === 'VIP Priority') score += 15;
    if (lead.status === 'Confirmed Stay') score += 10;
    if (lead.needs.includes('Senior') || lead.needs.includes('Ganga Facing')) score += 5;

    return Math.min(100, Math.max(10, score));
  }

  initElements() {
    // Buttons & Inputs
    this.openAddLeadModalBtn = document.getElementById('openAddLeadModalBtn');
    this.leadModal = document.getElementById('leadModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.cancelModalBtn = document.getElementById('cancelModalBtn');
    this.leadForm = document.getElementById('leadForm');
    this.searchInput = document.getElementById('searchInput');
    this.locationFilter = document.getElementById('locationFilter');
    this.typeFilter = document.getElementById('typeFilter');
    this.exportLeadsBtn = document.getElementById('exportLeadsBtn');
    this.seedDemoDataBtn = document.getElementById('seedDemoDataBtn');
    this.commLeadSelect = document.getElementById('commLeadSelect');
    this.commPreviewText = document.getElementById('commPreviewText');
    this.copyCommBtn = document.getElementById('copyCommBtn');

    // Calculator inputs
    this.calcName = document.getElementById('calcName');
    this.calcGuests = document.getElementById('calcGuests');
    this.calcNights = document.getElementById('calcNights');
    this.calcRoomType = document.getElementById('calcRoomType');
    this.chkMeal = document.getElementById('chkMeal');
    this.chkPooja = document.getElementById('chkPooja');
    this.chkPickup = document.getElementById('chkPickup');
    this.calcReceiptText = document.getElementById('calcReceiptText');
  }

  initEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');

        if (targetTab === 'analyticsTab') {
          this.updateCharts();
        } else if (targetTab === 'communicationTab') {
          this.renderCommHub();
        } else if (targetTab === 'itineraryTab') {
          this.renderCalculator();
        }
      });
    });

    // Filters
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderKanban();
    });

    this.locationFilter.addEventListener('change', (e) => {
      this.selectedLocation = e.target.value;
      this.renderKanban();
    });

    this.typeFilter.addEventListener('change', (e) => {
      this.selectedType = e.target.value;
      this.renderKanban();
    });

    // Modal Events
    this.openAddLeadModalBtn.addEventListener('click', () => this.openModal());
    this.closeModalBtn.addEventListener('click', () => this.closeModal());
    this.cancelModalBtn.addEventListener('click', () => this.closeModal());
    this.leadModal.addEventListener('click', (e) => {
      if (e.target === this.leadModal) this.closeModal();
    });

    this.leadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Communication Pills
    document.querySelectorAll('#langPills .pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#langPills .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.commLang = btn.getAttribute('data-lang');
        this.renderCommHub();
      });
    });

    document.querySelectorAll('#templatePills .pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#templatePills .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.commTpl = btn.getAttribute('data-tpl');
        this.renderCommHub();
      });
    });

    this.commLeadSelect.addEventListener('change', () => this.renderCommHub());
    this.copyCommBtn.addEventListener('click', () => this.copyCommMessage());

    // Calculator Inputs
    [this.calcName, this.calcGuests, this.calcNights, this.calcRoomType, this.chkMeal, this.chkPooja, this.chkPickup].forEach(elem => {
      if (elem) elem.addEventListener('input', () => this.renderCalculator());
    });

    // Global Actions
    this.exportLeadsBtn.addEventListener('click', () => this.exportLeads());
    this.seedDemoDataBtn.addEventListener('click', () => this.resetDemoData());

    // Drag & Drop for Kanban Columns
    this.initDragAndDrop();
  }

  initDragAndDrop() {
    document.querySelectorAll('.kanban-column').forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.style.background = 'rgba(212, 175, 55, 0.08)';
      });

      column.addEventListener('dragleave', () => {
        column.style.background = '';
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.style.background = '';
        const leadId = e.dataTransfer.getData('text/plain');
        const newStatus = column.getAttribute('data-status');
        if (leadId && newStatus) {
          this.updateLeadStatus(leadId, newStatus);
        }
      });
    });
  }

  render() {
    this.renderStats();
    this.renderKanban();
  }

  renderStats() {
    const total = this.leads.length;
    let highPriority = 0;
    let pendingFollowup = 0;
    let confirmed = 0;

    this.leads.forEach(l => {
      const score = this.calculateLeadScore(l);
      if (score >= 75) highPriority++;
      if (l.status === 'Follow-Up Scheduled' || l.status === 'New Inquiry') pendingFollowup++;
      if (l.status === 'Confirmed Stay') confirmed++;
    });

    document.getElementById('statTotalLeads').innerText = total;
    document.getElementById('statHighPriorityLeads').innerText = highPriority;
    document.getElementById('statPendingFollowups').innerText = pendingFollowup;
    const ratio = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    document.getElementById('statConfirmedRatio').innerText = `${ratio}%`;
  }

  renderKanban() {
    const columns = {
      'New Inquiry': document.getElementById('col-NewInquiry'),
      'Follow-Up Scheduled': document.getElementById('col-FollowUp'),
      'Confirmed Stay': document.getElementById('col-ConfirmedStay'),
      'VIP Priority': document.getElementById('col-VipPriority')
    };

    const counts = {
      'New Inquiry': 0,
      'Follow-Up Scheduled': 0,
      'Confirmed Stay': 0,
      'VIP Priority': 0
    };

    // Clear existing
    Object.values(columns).forEach(col => col.innerHTML = '');

    const filtered = this.leads.filter(lead => {
      const matchesSearch = lead.name.toLowerCase().includes(this.searchQuery) ||
                            lead.phone.includes(this.searchQuery) ||
                            lead.notes.toLowerCase().includes(this.searchQuery);
      const matchesLoc = this.selectedLocation === 'ALL' || lead.location === this.selectedLocation;
      const matchesType = this.selectedType === 'ALL' || lead.type === this.selectedType;
      return matchesSearch && matchesLoc && matchesType;
    });

    filtered.forEach(lead => {
      const score = this.calculateLeadScore(lead);
      let scoreClass = 'score-low';
      if (score >= 75) scoreClass = 'score-high';
      else if (score >= 50) scoreClass = 'score-med';

      const card = document.createElement('div');
      card.className = 'lead-card';
      card.draggable = true;
      card.setAttribute('data-id', lead.id);

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', lead.id);
      });

      card.innerHTML = `
        <div class="lead-header">
          <div class="lead-name">${this.escapeHtml(lead.name)}</div>
          <span class="lead-score ${scoreClass}">Priority ${score}</span>
        </div>
        <div class="lead-meta">
          <span class="lead-tag"><i class="fa-solid fa-location-dot"></i> ${lead.location}</span>
          <span class="lead-tag"><i class="fa-solid fa-users"></i> ${lead.guests} Guests</span>
          <span class="lead-tag"><i class="fa-solid fa-moon"></i> ${lead.nights} Nights</span>
        </div>
        <div class="lead-details-preview">${this.escapeHtml(lead.notes || 'No extra notes.')}</div>
        <div class="lead-footer">
          <span style="color: var(--gold-light); font-size: 0.75rem;"><i class="fa-solid fa-phone"></i> ${lead.phone}</span>
          <div class="lead-actions">
            <button class="action-btn" title="Edit Lead" onclick="app.editLead('${lead.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn" title="Delete Lead" onclick="app.deleteLead('${lead.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;

      const targetCol = columns[lead.status] || columns['New Inquiry'];
      targetCol.appendChild(card);
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    });

    // Update count badges
    document.getElementById('count-NewInquiry').innerText = counts['New Inquiry'] || 0;
    document.getElementById('count-FollowUp').innerText = counts['Follow-Up Scheduled'] || 0;
    document.getElementById('count-ConfirmedStay').innerText = counts['Confirmed Stay'] || 0;
    document.getElementById('count-VipPriority').innerText = counts['VIP Priority'] || 0;
  }

  updateLeadStatus(leadId, newStatus) {
    const lead = this.leads.find(l => l.id === leadId);
    if (lead) {
      lead.status = newStatus;
      this.saveLeads();
      this.render();
      this.showToast(`Updated stage for ${lead.name} to "${newStatus}"`);
    }
  }

  openModal(leadToEdit = null) {
    this.leadForm.reset();
    if (leadToEdit) {
      document.getElementById('modalTitle').innerText = 'Edit Ashram Inquiry Lead';
      document.getElementById('leadId').value = leadToEdit.id;
      document.getElementById('formName').value = leadToEdit.name;
      document.getElementById('formPhone').value = leadToEdit.phone;
      document.getElementById('formLocation').value = leadToEdit.location;
      document.getElementById('formType').value = leadToEdit.type;
      document.getElementById('formGuests').value = leadToEdit.guests;
      document.getElementById('formNights').value = leadToEdit.nights;
      document.getElementById('formStatus').value = leadToEdit.status;
      document.getElementById('formNeeds').value = leadToEdit.needs;
      document.getElementById('formNotes').value = leadToEdit.notes;
    } else {
      document.getElementById('modalTitle').innerText = 'New Ashram Inquiry Lead';
      document.getElementById('leadId').value = '';
    }
    this.leadModal.classList.add('open');
  }

  closeModal() {
    this.leadModal.classList.remove('open');
  }

  handleFormSubmit() {
    const id = document.getElementById('leadId').value;
    const name = document.getElementById('formName').value.trim();
    const phone = document.getElementById('formPhone').value.trim();
    const location = document.getElementById('formLocation').value;
    const type = document.getElementById('formType').value;
    const guests = parseInt(document.getElementById('formGuests').value) || 1;
    const nights = parseInt(document.getElementById('formNights').value) || 1;
    const status = document.getElementById('formStatus').value;
    const needs = document.getElementById('formNeeds').value;
    const notes = document.getElementById('formNotes').value.trim();

    if (!name || !phone) {
      this.showToast('Please enter Pilgrim Name and Phone number.', 'error');
      return;
    }

    if (id) {
      // Edit existing
      const index = this.leads.findIndex(l => l.id === id);
      if (index !== -1) {
        this.leads[index] = { ...this.leads[index], name, phone, location, type, guests, nights, status, needs, notes };
        this.showToast(`Updated lead for ${name}`);
      }
    } else {
      // Create new
      const newLead = {
        id: 'lead-' + Date.now(),
        name,
        phone,
        location,
        type,
        guests,
        nights,
        status,
        needs,
        notes,
        createdAt: new Date().toISOString().split('T')[0]
      };
      this.leads.unshift(newLead);
      this.showToast(`Added new lead for ${name}`);
    }

    this.saveLeads();
    this.closeModal();
    this.render();
  }

  editLead(id) {
    const lead = this.leads.find(l => l.id === id);
    if (lead) {
      this.openModal(lead);
    }
  }

  deleteLead(id) {
    if (confirm('Are you sure you want to delete this ashram inquiry lead?')) {
      this.leads = this.leads.filter(l => l.id !== id);
      this.saveLeads();
      this.render();
      this.showToast('Lead deleted successfully.');
    }
  }

  renderCommHub() {
    this.commLeadSelect.innerHTML = '';
    this.leads.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.innerText = `${l.name} (${l.location} - ${l.phone})`;
      this.commLeadSelect.appendChild(opt);
    });

    const selectedId = this.commLeadSelect.value;
    const lead = this.leads.find(l => l.id === selectedId) || this.leads[0];
    if (!lead) {
      this.commPreviewText.innerText = 'No leads available.';
      return;
    }

    let text = '';
    const code = Math.floor(100000 + Math.random() * 900000);

    if (this.commLang === 'HI') {
      if (this.commTpl === 'welcome') {
        text = `🕉️ नमस्ते ${lead.name} जी,\n\nत्रिबोना (आश्रय भारत) आश्रम सेवा में आपका हार्दिक स्वागत है।\n\nआपकी ${lead.location} आश्रम हेतु ${lead.guests} श्रद्धालुओं के ${lead.nights} दिवसीय ${lead.type} संबंधी पूछताछ हमें प्राप्त हुई है।\n\nविशेष व्यवस्था: ${lead.needs}\n\nकमरों की उपलब्धता एवं सतसंग सेवा हेतु कृपया इस संदेश का उत्तर दें।\n\nशुभकामनाएं,\nतीर्थाटन प्रबंधन टीम | Tirvona Ashram`;
      } else if (this.commTpl === 'followup') {
        text = `🕉️ जय श्री राम / हरि ॐ ${lead.name} जी,\n\n${lead.location} आश्रम प्रवास हेतु टोकन पुष्टि का अनुस्मारक संदेश।\n\nतिथि एवं व्यवस्था लॉक करने के लिए कृपया ऑनलाइन टोकन राशि जमा करें।\n\nहेल्पलाइन: +91 800-TIRVONA`;
      } else if (this.commTpl === 'checkin') {
        text = `🕉️ आपका चेक-इन कोड: ${code}\n\nआदरणीय ${lead.name} जी,\n\n${lead.location} आश्रम के काउंटर पर यह 6-अंकीय कोड दिखाएं।\n\nसात्विक भोजन का समय:\n• प्रातः अल्पाहार: 7:30 AM - 9:00 AM\n• सात्विक भोजन: 12:30 PM - 2:00 PM\n• संध्या महाप्रसाद: 7:30 PM - 9:00 PM`;
      } else {
        text = `🕉️ जय श्री कृष्णा ${lead.name} जी,\n\nआशा है कि ${lead.location} आश्रम में आपका साधना प्रवास सुखद एवं दिव्य रहा होगा।\n\nपुनः दर्शन की कामना के साथ,\nTirvona Ashram Seva Team`;
      }
    } else {
      if (this.commTpl === 'welcome') {
        text = `🕉️ Namaste ${lead.name},\n\nWarm greetings from Tirvona Ashram Booking & Retreat Management.\n\nWe received your inquiry for a ${lead.nights}-night ${lead.type} in ${lead.location} for ${lead.guests} guests.\n\nAccommodation Preference: ${lead.needs}\n\nPlease reply to confirm room availability and Satvic meal preferences.\n\nWith Blessings,\nTirvona Ashram Seva Desk`;
      } else if (this.commTpl === 'followup') {
        text = `🕉️ Greetings ${lead.name},\n\nThis is a friendly follow-up regarding your upcoming spiritual stay in ${lead.location}.\n\nKindly confirm your stay token to finalize cottage allocation.\n\nContact: +91 800-TIRVONA`;
      } else if (this.commTpl === 'checkin') {
        text = `🕉️ Your 6-Digit Check-In Code: ${code}\n\nDear ${lead.name},\n\nPresent this code at the ${lead.location} Ashram desk for immediate cardless check-in.\n\nSatvic Dining Schedule:\n- Breakfast: 07:30 AM - 09:00 AM\n- Lunch Prasadam: 12:30 PM - 02:00 PM\n- Night Prasadam: 07:30 PM - 09:00 PM`;
      } else {
        text = `🕉️ Hari Om ${lead.name},\n\nThank you for choosing Tirvona for your spiritual retreat at ${lead.location}. May your journey remain blessed.\n\nWarm Regards,\nTirvona Management`;
      }
    }

    this.commPreviewText.innerText = text;
  }

  copyCommMessage() {
    const text = this.commPreviewText.innerText;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Copied message template to clipboard!');
    }).catch(err => {
      this.showToast('Failed to copy message.', 'error');
    });
  }

  renderCalculator() {
    const name = this.calcName.value || 'Pilgrim Lead';
    const guests = parseInt(this.calcGuests.value) || 1;
    const nights = parseInt(this.calcNights.value) || 1;
    const roomRate = parseInt(this.calcRoomType.value) || 1200;

    const roomTotal = roomRate * nights;
    const mealTotal = this.chkMeal.checked ? (200 * guests * nights) : 0;
    const poojaTotal = this.chkPooja.checked ? 1000 : 0;
    const pickupTotal = this.chkPickup.checked ? 1500 : 0;

    const grandTotal = roomTotal + mealTotal + poojaTotal + pickupTotal;

    const receipt = `
==================================================
        🕉️ TIRVONA ASHRAM STAY ESTIMATE
==================================================
Guest Name      : ${name}
Pilgrim Count   : ${guests} Person(s)
Stay Duration   : ${nights} Night(s)
--------------------------------------------------
Room Charge (${nights} N x ₹${roomRate}) : ₹${roomTotal.toLocaleString('en-IN')}
Satvic Bhojanam Prasadam   : ₹${mealTotal.toLocaleString('en-IN')}
Special Aarti / Pooja Booking : ₹${poojaTotal.toLocaleString('en-IN')}
Vedic Escort Transport       : ₹${pickupTotal.toLocaleString('en-IN')}
--------------------------------------------------
ESTIMATED TOTAL              : ₹${grandTotal.toLocaleString('en-IN')}
==================================================
Note: Govt Tax Exemption Applicable for Trust Stays.
Generates 6-Digit Pilgrim Code upon Token Payment.
    `.trim();

    this.calcReceiptText.innerText = receipt;
  }

  initCharts() {
    const ctxLoc = document.getElementById('locationChart');
    const ctxFun = document.getElementById('funnelChart');
    const ctxTyp = document.getElementById('typeChart');

    if (!ctxLoc || !ctxFun || !ctxTyp) return;

    this.charts.location = new Chart(ctxLoc, {
      type: 'doughnut',
      data: {
        labels: ['Rishikesh', 'Varanasi', 'Vrindavan', 'Haridwar', 'Ayodhya'],
        datasets: [{
          data: [1, 1, 1, 1, 1],
          backgroundColor: ['#d4af37', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#f8fafc' } }
        }
      }
    });

    this.charts.funnel = new Chart(ctxFun, {
      type: 'bar',
      data: {
        labels: ['New Inquiries', 'Follow-Up', 'Confirmed', 'VIP Priority'],
        datasets: [{
          label: 'Leads Count',
          data: [1, 1, 1, 1],
          backgroundColor: '#d4af37',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });

    this.charts.type = new Chart(ctxTyp, {
      type: 'polarArea',
      data: {
        labels: ['Sadhana Stay', 'Group Yatra', 'Corporate Retreat', 'Veda Pathshala', 'Seva Volunteer'],
        datasets: [{
          data: [1, 1, 1, 1, 1],
          backgroundColor: ['rgba(212,175,55,0.6)', 'rgba(16,185,129,0.6)', 'rgba(59,130,246,0.6)', 'rgba(139,92,246,0.6)', 'rgba(244,63,94,0.6)']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#f8fafc' } } }
      }
    });

    this.updateCharts();
  }

  updateCharts() {
    if (!this.charts.location) return;

    // Location distribution
    const locCounts = { Rishikesh: 0, Varanasi: 0, Vrindavan: 0, Haridwar: 0, Ayodhya: 0 };
    const statusCounts = { 'New Inquiry': 0, 'Follow-Up Scheduled': 0, 'Confirmed Stay': 0, 'VIP Priority': 0 };
    const typeCounts = { 'Sadhana Stay': 0, 'Group Yatra': 0, 'Corporate Retreat': 0, 'Veda Pathshala': 0, 'Seva Volunteer': 0 };

    this.leads.forEach(l => {
      if (locCounts[l.location] !== undefined) locCounts[l.location]++;
      if (statusCounts[l.status] !== undefined) statusCounts[l.status]++;
      if (typeCounts[l.type] !== undefined) typeCounts[l.type]++;
    });

    this.charts.location.data.datasets[0].data = Object.values(locCounts);
    this.charts.location.update();

    this.charts.funnel.data.datasets[0].data = Object.values(statusCounts);
    this.charts.funnel.update();

    this.charts.type.data.datasets[0].data = Object.values(typeCounts);
    this.charts.type.update();
  }

  exportLeads() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.leads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tirvona_ashram_leads_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.showToast('Exported ashram leads to JSON file.');
  }

  resetDemoData() {
    if (confirm('Reset to original sample Ashram Lead data? Custom changes will be cleared.')) {
      this.leads = [...DEFAULT_LEADS];
      this.saveLeads();
      this.render();
      this.updateCharts();
      this.showToast('Reset to demo Ashram leads.');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'error') toast.style.borderLeftColor = 'var(--accent-rose)';

    toast.innerHTML = `
      <i class="${type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-om'}" style="color: var(--gold-light);"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new AshramLeadApp();
});
