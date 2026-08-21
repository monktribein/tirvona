import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const HI_TRANSLATIONS = {
  "Tirvona": "तिरवोना",
  "Field Supervisor": "फील्ड सुपरवाइज़र",
  "Super Admin": "सुपर एडमिन",
  "Field Agent": "फील्ड एजेंट",
  "Lead Portal": "लीड पोर्टल",
  "Public Portal": "लीड पोर्टल",
  "Sign Out": "साइन आउट",
  "Login": "लॉग इन",
  "Sign In": "साइन इन",
  "Overview": "अवलोकन",
  "Field Agents": "फील्ड एजेंट",
  "LEAD COLLECTION": "लीड संकलन",
  "Jurisdiction": "अधिकार क्षेत्र",
  "District": "ज़िला",
  "State": "राज्य",
  "Role": "भूमिका",
  "Supervisor": "सुपरवाइज़र",
  "Agent": "एजेंट",
  "Lead Executive": "लीड एग्जीक्यूटिव",
  "Attendance": "उपस्थिति",
  "Supervisor Attendance": "सुपरवाइज़र उपस्थिति",
  "Field Agent Attendance": "फील्ड एजेंट उपस्थिति",
  "Lead Executive Attendance": "लीड एग्जीक्यूटिव उपस्थिति",
  "Check In": "चेक इन",
  "Checked In": "चेक इन किया गया",
  "Check Out": "चेक आउट",
  "Checked Out": "चेक आउट किया गया",
  "Active Shift": "सक्रिय शिफ्ट",
  "Attendance Log Record": "उपस्थिति रिकॉर्ड",
  "Check-In Status": "चेक-इन स्थिति",
  "Check-Out Status": "चेक-आउट स्थिति",
  "Continue to Dashboard": "डैशबोर्ड पर जारी रखें",
  "Continue to Field Dashboard": "फील्ड डैशबोर्ड पर जारी रखें",

  "Search": "खोजें",
  "Search in": "यहाँ खोजें",
  "Search pages, agents, ashrams, leads in": "पेज, एजेंट, आश्रम, लीड खोजें",
  "Search field agents by name, phone, code...": "नाम, फ़ोन, कोड द्वारा फील्ड एजेंट खोजें...",
  "Create Field Agent": "फील्ड एजेंट बनाएँ",
  "Add Field Agent": "फील्ड एजेंट जोड़ें",
  "Add New Agent": "नया एजेंट जोड़ें",
  "Save": "सहेजें",
  "Cancel": "रद्द करें",
  "Close": "बंद करें",
  "Edit": "संपादित करें",
  "Delete": "हटाएँ",
  "Actions": "कार्रवाइयाँ",
  "View": "देखें",
  "View Details": "विवरण देखें",
  "Open in Form": "फॉर्म में खोलें",
  "Reset Password": "पासवर्ड रीसेट करें",
  "Suspend Agent": "एजेंट निलंबित करें",
  "Activate Agent": "एजेंट सक्रिय करें",
  "Delete Agent": "एजेंट हटाएँ",

  "Notifications": "सूचनाएँ",
  "Select Language": "भाषा चुनें",
  "English": "English",
  "Hindi": "हिन्दी",
  "Sanskrit": "संस्कृतम्",
  "Mark all as read": "सभी को पढ़ा हुआ चिह्नित करें",
  "New": "नया",
  "Lead Verification Pending": "लीड सत्यापन लंबित",
  "Field Agent Active": "फील्ड एजेंट सक्रिय",
  "District Coverage Sync": "ज़िला कवरेज सिंक",
  "Captured Leads": "दर्ज की गई लीड्स",
  "No captured leads found for this agent": "इस एजेंट के लिए कोई दर्ज लीड नहीं मिली",
  "No field agents found": "कोई फील्ड एजेंट नहीं मिला",
  "Total Leads": "कुल लीड्स",
  "Employee Code": "कर्मचारी कोड",
  "Email": "ईमेल",
  "Phone": "फ़ोन",
  "Last Login": "अंतिम लॉगिन",
  "Password": "पासवर्ड",
  "Notes": "टिप्पणियाँ",
  "Update Agent": "एजेंट अपडेट करें",
  "Create Agent": "एजेंट बनाएँ",
  "Confirm Delete": "हटाने की पुष्टि करें",
  "Are you sure you want to delete": "क्या आप वाकई हटाना चाहते हैं",
  "Enter new password for": "इसके लिए नया पासवर्ड दर्ज करें",
  "Set New Password": "नया पासवर्ड सेट करें",
  "Updating": "अपडेट हो रहा है...",
  "Creating": "बन रहा है...",
  "Saving": "सहेजा जा रहा है..."
};

const LanguageContext = createContext({
  language: 'EN',
  setLanguage: () => {},
  t: (text) => text
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('tirvona_lead_lang') || 'EN';
    } catch {
      return 'EN';
    }
  });

  const setLanguage = useCallback((newLang) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem('tirvona_lead_lang', newLang);
    } catch {}
  }, []);

  const t = useCallback((text) => {
    if (!text || typeof text !== 'string') return text;
    if (language === 'HI') {
      return HI_TRANSLATIONS[text.trim()] || text;
    }
    return text;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
