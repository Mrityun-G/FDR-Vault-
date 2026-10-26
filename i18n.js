/* English / हिन्दी interface language.
   UI text is written in English in the templates; when Hindi is selected, rendered UI phrases are translated
   in place (MutationObserver), so screens, sheets and toasts all switch. Data (institution names, numbers,
   dates, document text) is never translated. Elements with translate="no" are skipped. */
'use strict';

const I18N = (() => {
  const KEY = 'aicte-lang';
  const HI = {
    // onboarding / brand
    'All India Council for Technical Education': 'अखिल भारतीय तकनीकी शिक्षा परिषद',
    'Ministry of Education': 'शिक्षा मंत्रालय', 'Ministry of Education ·': 'शिक्षा मंत्रालय ·', 'Government of India': 'भारत सरकार',
    'Institution Portal': 'संस्थान पोर्टल', 'AI-Assisted Scrutiny': 'एआई-सहायित जाँच', 'Security Deposit': 'सुरक्षा जमा',
    'Intelligent Regulatory': 'इंटेलिजेंट नियामक', 'Validation Platform': 'सत्यापन प्लेटफ़ॉर्म',
    'Security Deposit / FDR Management': 'सुरक्षा जमा / एफडीआर प्रबंधन', 'Approval & Compliance': 'अनुमोदन एवं अनुपालन',
    'AI Document Validation': 'एआई दस्तावेज़ सत्यापन', 'Joint Lien Lifecycle': 'संयुक्त ग्रहणाधिकार जीवनचक्र',
    'OCR extraction, SHA-256 duplicate forensics, 2D QR decoding and certificate expiry checks — before you submit.': 'जमा करने से पहले ओसीआर निष्कर्षण, SHA-256 डुप्लिकेट जाँच, 2D QR डिकोडिंग और प्रमाणपत्र वैधता जाँच।',
    'Track CBS lien endorsement, 10-year maturity, renewals, replacements and lien release from your phone.': 'सीबीएस ग्रहणाधिकार पृष्ठांकन, 10-वर्षीय परिपक्वता, नवीनीकरण, प्रतिस्थापन और ग्रहणाधिकार मुक्ति — अपने फ़ोन से ट्रैक करें।',
    'Skip': 'छोड़ें', 'Next': 'आगे', 'Get Started': 'शुरू करें', 'Login': 'लॉगिन', 'Register': 'पंजीकरण',
    'Privacy Policy': 'गोपनीयता नीति', 'Help': 'सहायता', 'Help & Support': 'सहायता एवं समर्थन', 'Terms of Use': 'उपयोग की शर्तें',
    'AICTE Leadership': 'एआईसीटीई नेतृत्व', 'Chairman Secretariat': 'अध्यक्ष सचिवालय', 'Advisers': 'सलाहकार', 'Directors': 'निदेशक',
    'Chairman': 'अध्यक्ष', 'Vice Chairman': 'उपाध्यक्ष', 'Member Secretary': 'सदस्य सचिव', 'Director': 'निदेशक', 'Adviser-I': 'सलाहकार-I', 'Adviser-II': 'सलाहकार-II', 'Chief Coordinating Officer': 'मुख्य समन्वय अधिकारी',
    'Approval Process Handbook': 'अनुमोदन प्रक्रिया पुस्तिका', 'Open handbook (PDF)': 'पुस्तिका खोलें (PDF)', 'Norms and procedures for AICTE approval of technical institutions.': 'तकनीकी संस्थानों के एआईसीटीई अनुमोदन के मानदंड और प्रक्रियाएँ।',
    'About AICTE': 'एआईसीटीई के बारे में', 'Motto': 'आदर्श वाक्य', 'Headquarters': 'मुख्यालय', 'Website': 'वेबसाइट',
    'AICTE · New Delhi': 'एआईसीटीई · नई दिल्ली', 'AICTE · Mumbai': 'एआईसीटीई · मुंबई', 'Introduction': 'परिचय',
    'Connecting securely…': 'सुरक्षित रूप से जुड़ रहे हैं…', 'Retry': 'पुनः प्रयास करें',
    // FDR Vault design (redesigned screens)
    'Security Deposit & Approvals Portal': 'सुरक्षा जमा एवं अनुमोदन पोर्टल', 'AICTE · Institution Portal': 'एआईसीटीई · संस्थान पोर्टल',
    'Email OTP': 'ईमेल ओटीपी', 'Google': 'Google', 'Head of Institution & Login': 'संस्थान प्रमुख एवं लॉगिन',
    'Weak': 'कमज़ोर', 'Fair': 'ठीक', 'Good': 'अच्छा', 'Strong': 'मज़बूत', 'Today': 'आज', 'Earlier': 'पहले',
    'Account': 'खाता', 'Compliance & Records': 'अनुपालन एवं अभिलेख', 'Eligible for lien release': 'ग्रहणाधिकार मुक्ति हेतु पात्र',
    'Total corpus under irrevocable joint lien': 'अपरिवर्तनीय संयुक्त ग्रहणाधिकार के अधीन कुल कोष',
    'Leave this screen?': 'यह स्क्रीन छोड़ें?', 'You have changes on this screen that are not saved yet.': 'इस स्क्रीन पर आपके बदलाव अभी सहेजे नहीं गए हैं।',
    'Save draft & leave': 'ड्राफ़्ट सहेजें और जाएँ', 'Leave without saving': 'बिना सहेजे जाएँ', 'Keep editing': 'संपादन जारी रखें',
    // login / register
    'Institution ID / Registered Email': 'संस्थान आईडी / पंजीकृत ईमेल', 'Registered Email': 'पंजीकृत ईमेल', 'Password': 'पासवर्ड',
    'Remember me': 'मुझे याद रखें', 'Forgot Password?': 'पासवर्ड भूल गए?', 'OR': 'या', 'Sign in with OTP': 'ओटीपी से साइन इन करें',
    'Login with Government SSO': 'सरकारी एसएसओ से लॉगिन', 'Continue with Google': 'Google से जारी रखें','Quick Fill Test Credentials': 'परीक्षण क्रेडेंशियल भरें',
    'New Institution?': 'नया संस्थान?', 'Register Now': 'अभी पंजीकरण करें', 'Authentication Failed': 'प्रमाणीकरण विफल',
    'Authenticating credentials...': 'क्रेडेंशियल सत्यापित हो रहे हैं...', 'Demo mode · data stays on this device': 'डेमो मोड · डेटा इसी डिवाइस पर रहता है',
    'This portal is for technical institutions. AICTE officials, scrutiny reviewers and bank officials sign in on the AICTE Admin Portal.': 'यह पोर्टल तकनीकी संस्थानों के लिए है। एआईसीटीई अधिकारी, जाँच समीक्षक और बैंक अधिकारी एआईसीटीई एडमिन पोर्टल पर साइन इन करें।',
    'Protected system under Section 43 & 66 of Information Technology Act, 2000. Unauthorized access is prohibited.': 'सूचना प्रौद्योगिकी अधिनियम, 2000 की धारा 43 एवं 66 के अंतर्गत संरक्षित प्रणाली। अनधिकृत पहुँच निषिद्ध है।',
    'Institution Name': 'संस्थान का नाम', 'Permanent Institute ID / Application ID': 'स्थायी संस्थान आईडी / आवेदन आईडी', 'State': 'राज्य',
    'District / City': 'ज़िला / शहर', 'Institution Type': 'संस्थान का प्रकार', 'Head of Institution': 'संस्थान प्रमुख', 'Official Email': 'आधिकारिक ईमेल',
    'Mobile Number': 'मोबाइल नंबर', 'Create Password': 'पासवर्ड बनाएँ', 'Confirm Password': 'पासवर्ड की पुष्टि करें', 'Submit Registration Request': 'पंजीकरण अनुरोध जमा करें',
    'Registration Request Submitted': 'पंजीकरण अनुरोध जमा हुआ', 'Done': 'ठीक है', 'Send OTP': 'ओटीपी भेजें', 'Verify & Login': 'सत्यापित करें और लॉगिन करें',
    'Resend OTP': 'ओटीपी पुनः भेजें', 'Enter 6-digit OTP': '6-अंकीय ओटीपी दर्ज करें', 'Reset your password': 'अपना पासवर्ड रीसेट करें', 'Send reset link': 'रीसेट लिंक भेजें',
    'Government SSO': 'सरकारी एसएसओ', 'Credential Recovery / Reset Policy': 'क्रेडेंशियल पुनर्प्राप्ति / रीसेट नीति',
    'Regulatory Evaluation & Prototype Notice': 'नियामक मूल्यांकन एवं प्रोटोटाइप सूचना', 'I Understand & Acknowledge': 'मैं समझता/समझती हूँ और स्वीकार करता/करती हूँ',
    // navigation / dashboard
    'Home': 'होम', 'Applications': 'आवेदन', 'FDR': 'एफडीआर', 'Alerts': 'सूचनाएँ', 'Profile': 'प्रोफ़ाइल',
    'Total Applications': 'कुल आवेदन', 'Under Scrutiny': 'जाँच में', 'Clarification Required': 'स्पष्टीकरण आवश्यक', 'Approved / Cleared': 'अनुमोदित / स्वीकृत',
    'Quick Actions': 'त्वरित कार्य', 'New Application': 'नया आवेदन', 'My Applications': 'मेरे आवेदन', 'FDR Details': 'एफडीआर विवरण', 'Compliance': 'अनुपालन',
    'Important Alerts': 'महत्वपूर्ण सूचनाएँ', 'View All': 'सभी देखें', 'Security Deposit (FDR)': 'सुरक्षा जमा (एफडीआर)', 'CORPUS UNDER AICTE JOINT LIEN': 'एआईसीटीई संयुक्त ग्रहणाधिकार के अधीन कोष',
    'Recent Activity': 'हाल की गतिविधि', 'No recent activity records found.': 'कोई हाल की गतिविधि नहीं मिली।',
    // statuses
    'Draft': 'मसौदा', 'Submitted': 'जमा किया गया', 'Under Review': 'समीक्षाधीन', 'Clarification': 'स्पष्टीकरण', 'Approved': 'अनुमोदित', 'All': 'सभी',
    'Scrutiny Cleared': 'जाँच पूर्ण', 'Rejected': 'अस्वीकृत', 'Active (Lien Secured)': 'सक्रिय (ग्रहणाधिकार सुरक्षित)', 'Expiring Soon': 'शीघ्र परिपक्व',
    'Matured (10-Yr Met)': 'परिपक्व (10 वर्ष पूर्ण)', 'Under Verification': 'सत्यापनाधीन', 'Lien Released': 'ग्रहणाधिकार मुक्त',
    'Passed': 'उत्तीर्ण', 'Warning': 'चेतावनी', 'Critical': 'गंभीर', 'Not evaluated': 'मूल्यांकन नहीं', 'Processed': 'संसाधित', 'Flagged': 'चिह्नित', 'New': 'नया',
    // application types / wizard
    'Select the type of application': 'आवेदन का प्रकार चुनें', 'Approval Application': 'अनुमोदन आवेदन', 'Apply for new course / increase in intake': 'नए पाठ्यक्रम / प्रवेश वृद्धि के लिए आवेदन',
    'Extension of Approval': 'अनुमोदन विस्तार', 'Apply for extension of existing approval': 'मौजूदा अनुमोदन के विस्तार के लिए आवेदन',
    'Change in Institution Details': 'संस्थान विवरण में परिवर्तन', 'Address, management, name, built-up area change etc.': 'पता, प्रबंधन, नाम, निर्मित क्षेत्र आदि में परिवर्तन',
    'Change in Program Details': 'कार्यक्रम विवरण में परिवर्तन', 'Add / remove / change course, intake variation': 'पाठ्यक्रम जोड़ें / हटाएँ / बदलें, प्रवेश परिवर्तन',
    'FDR / Security Deposit Related Request': 'एफडीआर / सुरक्षा जमा संबंधी अनुरोध', 'Submit new FDR, renewal / replacement, bank change, lien release': 'नया एफडीआर, नवीनीकरण / प्रतिस्थापन, बैंक परिवर्तन, ग्रहणाधिकार मुक्ति',
    'Closure / Withdrawal': 'बंदी / वापसी', 'For closure or surrender of approval': 'अनुमोदन की बंदी या समर्पण के लिए',
    'Institution': 'संस्थान', 'Program': 'कार्यक्रम', 'Documents': 'दस्तावेज़', 'Back': 'पीछे', 'Save Draft': 'मसौदा सहेजें', 'Validate': 'सत्यापित करें',
    'Continue': 'जारी रखें', 'Cancel': 'रद्द करें', 'Submit': 'जमा करें', 'Save': 'सहेजें', 'Save Changes': 'परिवर्तन सहेजें', 'Edit': 'संपादित करें', 'Close': 'बंद करें',
    'Institution Details': 'संस्थान विवरण', 'Program Details': 'कार्यक्रम विवरण', 'Intake, Faculty & Infrastructure': 'प्रवेश, संकाय एवं अवसंरचना',
    'Permanent Institute ID': 'स्थायी संस्थान आईडी', 'AICTE Region': 'एआईसीटीई क्षेत्र', 'Address': 'पता', 'Academic Year': 'शैक्षणिक वर्ष',
    'Current Total Intake': 'वर्तमान कुल प्रवेश', 'Proposed Total Intake': 'प्रस्तावित कुल प्रवेश', 'Total Students on Rolls': 'नामांकित कुल छात्र',
    'Professors': 'प्रोफ़ेसर', 'Assoc. Profs': 'एसो. प्रोफ़ेसर', 'Asst. Profs': 'सहा. प्रोफ़ेसर', 'Built-up Carpet Area (sq.m)': 'निर्मित कारपेट क्षेत्र (वर्ग मी.)',
    'FDR on Record': 'रिकॉर्ड में एफडीआर', 'Enter New FDR': 'नया एफडीआर दर्ज करें', 'FDR / Security Deposit Details': 'एफडीआर / सुरक्षा जमा विवरण',
    'FDR Number': 'एफडीआर संख्या', 'Bank Name': 'बैंक का नाम', 'Branch Name': 'शाखा का नाम', 'IFSC Code': 'आईएफ़एससी कोड', 'FDR Amount (₹)': 'एफडीआर राशि (₹)',
    'Issue Date': 'जारी करने की तिथि', 'Maturity Date': 'परिपक्वता तिथि', 'Joint Lien Holder': 'संयुक्त ग्रहणाधिकार धारक',
    'FDR is valid and within the required amount as per AICTE norms.': 'एफडीआर वैध है और एआईसीटीई मानदंडों के अनुसार आवश्यक राशि के भीतर है।',
    'Upload Supporting Documents': 'सहायक दस्तावेज़ अपलोड करें', 'Upload': 'अपलोड', 'Use sample': 'नमूना उपयोग करें', 'Valid till': 'वैधता तिथि',
    'Uploading securely…': 'सुरक्षित रूप से अपलोड हो रहा है…', 'Land Title / Registered Sale Deed': 'भूमि स्वामित्व / पंजीकृत विक्रय विलेख',
    'Building Stability / Completion Certificate': 'भवन स्थिरता / समापन प्रमाणपत्र', 'Fire Safety NOC': 'अग्नि सुरक्षा एनओसी', 'FDR Certificate (Joint Lien)': 'एफडीआर प्रमाणपत्र (संयुक्त ग्रहणाधिकार)',
    'University Affiliation Letter': 'विश्वविद्यालय संबद्धता पत्र', 'State Govt / DTE NOC': 'राज्य सरकार / डीटीई एनओसी', 'Certified Faculty Cadre Register': 'प्रमाणित संकाय संवर्ग रजिस्टर',
    'Bank Lien Confirmation Letter': 'बैंक ग्रहणाधिकार पुष्टि पत्र', 'Affidavit / Undertaking (if applicable)': 'शपथपत्र / वचनपत्र (यदि लागू हो)', 'Any Other Document': 'अन्य दस्तावेज़',
    'AI Preliminary Validation': 'एआई प्रारंभिक सत्यापन', 'Cross-Check Results': 'प्रति-जाँच परिणाम', 'Rule Engine Findings': 'नियम इंजन निष्कर्ष',
    'AI Advisory Summary': 'एआई सलाहकारी सारांश', 'Advisory Only': 'केवल सलाहकारी', 'Re-run validation': 'सत्यापन पुनः चलाएँ',
    'Review Application': 'आवेदन की समीक्षा करें', 'Application Summary': 'आवेदन सारांश', 'AI Pre-Validation': 'एआई पूर्व-सत्यापन', 'Details': 'विवरण',
    'e-Sign / Digital Consent': 'ई-हस्ताक्षर / डिजिटल सहमति', 'Sign & Submit': 'हस्ताक्षर करें और जमा करें', 'Sign using Aadhaar OTP / DSC / eSign': 'आधार ओटीपी / डीएससी / ई-साइन से हस्ताक्षर करें',
    'Submission Confirmation': 'जमा करने की पुष्टि', 'Application Submitted Successfully!': 'आवेदन सफलतापूर्वक जमा हुआ!',
    'Your application has been submitted to AICTE for review.': 'आपका आवेदन समीक्षा के लिए एआईसीटीई को भेज दिया गया है।',
    'Application Reference Number': 'आवेदन संदर्भ संख्या', 'Submitted On': 'जमा करने की तिथि', 'Download Acknowledgement': 'पावती डाउनलोड करें',
    'View Application': 'आवेदन देखें', 'Back to Home': 'होम पर वापस',
    // applications / detail
    'Search by Application ID': 'आवेदन आईडी से खोजें', 'Overview': 'सारांश', 'Findings': 'निष्कर्ष', 'Scrutiny': 'जाँच',
    'Regional Scrutiny': 'क्षेत्रीय जाँच', 'Scrutiny Recommendation': 'जाँच अनुशंसा', 'Bureau Decision': 'ब्यूरो निर्णय', 'Pending': 'लंबित',
    'Submit Response': 'उत्तर जमा करें', 'View Notice': 'सूचना देखें', 'Compliance Response': 'अनुपालन उत्तर', 'Deficiency Notice': 'कमी सूचना',
    'Print / Save PDF': 'प्रिंट / पीडीएफ़ सहेजें', 'Institutional Profile': 'संस्थागत प्रोफ़ाइल', 'Linked Security Deposit': 'संबद्ध सुरक्षा जमा',
    // FDR
    'FDR / Security Deposit': 'एफडीआर / सुरक्षा जमा', 'Submit New FDR': 'नया एफडीआर जमा करें', 'Renew / Replace / Release': 'नवीनीकरण / प्रतिस्थापन / मुक्ति',
    'My Deposits': 'मेरी जमा राशियाँ', 'TOTAL CORPUS UNDER IRREVOCABLE JOINT LIEN': 'अपरिवर्तनीय संयुक्त ग्रहणाधिकार के अधीन कुल कोष',
    'Process Renewal / Replacement': 'नवीनीकरण / प्रतिस्थापन करें', 'Initiate Release Request': 'मुक्ति अनुरोध प्रारंभ करें', 'Download FDR Advice': 'एफडीआर सलाह डाउनलोड करें',
    'Request Bank Change / Replacement': 'बैंक परिवर्तन / प्रतिस्थापन का अनुरोध', 'CBS Joint Lien Confirmed': 'सीबीएस संयुक्त ग्रहणाधिकार की पुष्टि',
    'Awaiting Bank CBS Endorsement': 'बैंक सीबीएस पृष्ठांकन की प्रतीक्षा', '10-Year Lock-in': '10-वर्षीय लॉक-इन', 'History': 'इतिहास',
    'Submit Statutory Renewal': 'वैधानिक नवीनीकरण जमा करें', 'Submit Discharge Application': 'मुक्ति आवेदन जमा करें', 'Request Lien Discharge': 'ग्रहणाधिकार मुक्ति अनुरोध',
    'Release Pending Bureau Approval': 'ब्यूरो अनुमोदन हेतु मुक्ति लंबित', 'Renewal request pending': 'नवीनीकरण अनुरोध लंबित', 'Replacement request pending': 'प्रतिस्थापन अनुरोध लंबित',
    // alerts / profile
    'Notifications': 'सूचनाएँ', 'Mark all read': 'सभी पढ़ा हुआ चिह्नित करें', 'Mark read': 'पढ़ा हुआ चिह्नित करें', 'Inspect': 'देखें',
    'No notifications matching current filter.': 'इस फ़िल्टर से मेल खाती कोई सूचना नहीं।',
    'Profile & Settings': 'प्रोफ़ाइल एवं सेटिंग्स', 'Contact Person Details': 'संपर्क व्यक्ति विवरण', 'Change Password': 'पासवर्ड बदलें',
    'FDR expiry, scrutiny & deficiency alerts': 'एफडीआर परिपक्वता, जाँच एवं कमी सूचनाएँ', 'Compliance & Verification': 'अनुपालन एवं सत्यापन',
    'Rule matrix & authority adapters': 'नियम मैट्रिक्स एवं प्राधिकरण एडाप्टर', 'Activity Log': 'गतिविधि लॉग', 'Tamper-evident audit trail': 'छेड़छाड़-प्रकट ऑडिट ट्रेल',
    'Grievance / Raise a Ticket': 'शिकायत / टिकट दर्ज करें', 'FAQs, handbooks, contact': 'सामान्य प्रश्न, पुस्तिकाएँ, संपर्क', 'About Portal': 'पोर्टल के बारे में',
    'Version, disclaimers': 'संस्करण, अस्वीकरण', 'Download Reports': 'रिपोर्ट डाउनलोड करें', 'FDR register, applications, activity (CSV)': 'एफडीआर रजिस्टर, आवेदन, गतिविधि (CSV)',
    'Switch Institution (Demo)': 'संस्थान बदलें (डेमो)', 'Explore other applicant personas': 'अन्य आवेदक प्रोफ़ाइल देखें', 'Logout': 'लॉगआउट', 'Language': 'भाषा',
    'Sign out of the AICTE Institution Portal on this device?': 'क्या इस डिवाइस पर एआईसीटीई संस्थान पोर्टल से साइन आउट करें?',
    'Grievance / Tickets': 'शिकायतें / टिकट', 'Raise New Ticket': 'नया टिकट दर्ज करें', 'Submit Ticket': 'टिकट जमा करें', 'Help & Support ': 'सहायता एवं समर्थन',
    'Frequently Asked Questions': 'अक्सर पूछे जाने वाले प्रश्न', 'Reference Handbooks': 'संदर्भ पुस्तिकाएँ', 'Contact': 'संपर्क', 'Raise a Ticket': 'टिकट दर्ज करें',
    'Update Password': 'पासवर्ड अपडेट करें', 'Current Password': 'वर्तमान पासवर्ड', 'New Password': 'नया पासवर्ड', 'Confirm New Password': 'नए पासवर्ड की पुष्टि करें',
    "You're offline": 'आप ऑफ़लाइन हैं', 'Back online': 'फिर से ऑनलाइन', 'Please wait…': 'कृपया प्रतीक्षा करें…', 'Submitting…': 'जमा हो रहा है…',
    'Saving…': 'सहेजा जा रहा है…',
    '& Support': 'एवं समर्थन',
    'Enter your password': 'अपना पासवर्ड दर्ज करें',
    'Mandatory Statutory System Disclaimer.': 'अनिवार्य वैधानिक प्रणाली अस्वीकरण।',
    'PROTOTYPE ONLY: This system does not constitute official regulatory approval or endorsement by AICTE.': 'केवल प्रोटोटाइप: यह प्रणाली एआईसीटीई द्वारा आधिकारिक नियामक अनुमोदन या समर्थन नहीं है।',
    'Strict Separation of Rules & AI Inference': 'नियमों एवं एआई अनुमान का सख़्त पृथक्करण',
    'The platform enforces strict structural separation between deterministic validation rules (v2026.1) and probabilistic AI extraction. AI generated summaries are advisory interpretations, labeled with disclaimers, and never treated as final regulatory decisions.': 'प्लेटफ़ॉर्म नियतात्मक सत्यापन नियमों (v2026.1) और संभाव्य एआई निष्कर्षण को पूरी तरह अलग रखता है। एआई सारांश केवल सलाहकारी व्याख्याएँ हैं, अस्वीकरण सहित, और कभी अंतिम नियामक निर्णय नहीं माने जाते।',
    'Simulated External Issuing Authorities': 'अनुकरणित बाहरी जारीकर्ता प्राधिकरण',
    'Integrations with State Directorate of Technical Education (DTE), Affiliating Universities, State Fire Services, and Core Banking (CBS) operate through simulated adapters for demonstration and test execution. No live government databases are polled.': 'राज्य तकनीकी शिक्षा निदेशालय (डीटीई), संबद्धक विश्वविद्यालयों, राज्य अग्निशमन सेवाओं और कोर बैंकिंग (सीबीएस) से एकीकरण प्रदर्शन एवं परीक्षण हेतु अनुकरणित एडाप्टर से होता है। किसी सरकारी डेटाबेस से लाइव डेटा नहीं लिया जाता।',
    'Human-in-the-Loop Review Requirement': 'मानवीय समीक्षा की अनिवार्यता',
    'Reviewers must provide formal regulatory rationale and statutory handbook citations to resolve deficiencies or override deterministic findings. Overrides are permanently captured in the tamper-evident audit ledger with correlation IDs.': 'कमियों के समाधान या नियतात्मक निष्कर्षों को बदलने के लिए समीक्षकों को औपचारिक नियामक कारण और वैधानिक पुस्तिका के संदर्भ देने होंगे। ऐसे सभी निर्णय छेड़छाड़-प्रकट ऑडिट लेजर में स्थायी रूप से दर्ज होते हैं।',
    'Document Forensics & Duplicate Detection': 'दस्तावेज़ फ़ोरेंसिक एवं डुप्लिकेट पहचान',
    'Calculated cryptographic SHA-256 hashes cross-verify institutional documents across applications to prevent the reuse of land sale deeds, building safety certificates, or fraudulent multi-trust filings.': 'गणना किए गए SHA-256 हैश सभी आवेदनों में संस्थागत दस्तावेज़ों का प्रति-सत्यापन करते हैं, ताकि भूमि विक्रय विलेख, भवन सुरक्षा प्रमाणपत्र या धोखाधड़ीपूर्ण बहु-ट्रस्ट फ़ाइलिंग का पुनः उपयोग रोका जा सके।',
    'All applications are evaluated by the deterministic APH v2026.1 rule engine and AI document forensics before Regional Scrutiny Committee review.': 'क्षेत्रीय जाँच समिति की समीक्षा से पहले सभी आवेदनों का मूल्यांकन एपीएच v2026.1 नियम इंजन और एआई दस्तावेज़ जाँच द्वारा किया जाता है।',
    'As per AICTE master registry. Use “Change in Institution Details” to request a name change.': 'एआईसीटीई मास्टर रजिस्ट्री के अनुसार। नाम परिवर्तन के लिए “संस्थान विवरण में परिवर्तन” आवेदन करें।',
    'Programme Level': 'कार्यक्रम स्तर', 'Programme / Course Name': 'कार्यक्रम / पाठ्यक्रम का नाम', 'Discipline': 'विषय-क्षेत्र', 'Proposed Intake': 'प्रस्तावित प्रवेश', 'Shift': 'पाली',
    'Nature of Change': 'परिवर्तन का प्रकार', 'Seats Affected': 'प्रभावित सीटें', 'Change since last approval': 'पिछले अनुमोदन के बाद परिवर्तन', 'Change Category': 'परिवर्तन श्रेणी',
    'Details of Change': 'परिवर्तन का विवरण', 'Requested Change': 'अनुरोधित परिवर्तन', 'Closure Details': 'बंदी विवरण', 'Closure Type': 'बंदी का प्रकार', 'Reason for Closure': 'बंदी का कारण',
    'LIVE NORM CHECK · APPENDIX 4 & 7': 'तत्काल मानदंड जाँच · परिशिष्ट 4 एवं 7', 'Student-Faculty Ratio (≤ 1:20)': 'छात्र-संकाय अनुपात (≤ 1:20)', 'Cadre ratio (norm 1:2:6)': 'संवर्ग अनुपात (मानदंड 1:2:6)',
    'Tenure is 10 years (APH Chapter VI lock-in)': 'अवधि 10 वर्ष है (एपीएच अध्याय VI लॉक-इन)', 'Maturity date is in the future': 'परिपक्वता तिथि भविष्य में है',
    'Bank details consistent (IFSC ↔ bank)': 'बैंक विवरण सुसंगत (आईएफ़एससी ↔ बैंक)', 'Joint lien in favour of Regional Officer, AICTE': 'संयुक्त ग्रहणाधिकार क्षेत्रीय अधिकारी, एआईसीटीई के पक्ष में',
    'Bank CBS lien endorsement': 'बैंक सीबीएस ग्रहणाधिकार पृष्ठांकन', 'Awaiting bank official endorsement in CBS': 'सीबीएस में बैंक अधिकारी के पृष्ठांकन की प्रतीक्षा',
    'FDR does not meet AICTE Chapter VI norms. It will be flagged as': 'एफडीआर एआईसीटीई अध्याय VI मानदंडों को पूरा नहीं करता। इसे', 'by RULE-FDR-CORPUS-07.': 'RULE-FDR-CORPUS-07 द्वारा चिह्नित किया जाएगा।',
    'Accepted formats: PDF, JPG, PNG · Maximum file size: 10 MB per file. A SHA-256 fingerprint is computed on your device for duplicate-document forensics.': 'स्वीकार्य प्रारूप: PDF, JPG, PNG · अधिकतम आकार: प्रति फ़ाइल 10 MB। डुप्लिकेट दस्तावेज़ जाँच के लिए आपके डिवाइस पर SHA-256 फ़िंगरप्रिंट बनाया जाता है।',
    'Attach sample set for remaining mandatory documents': 'शेष अनिवार्य दस्तावेज़ों के लिए नमूना सेट जोड़ें',
    'Documents are analysed using AI for completeness and consistency check. Pipeline: native PDF text + OCR fallback, SHA-256 forensics, 2D QR decoding, date chronology, APH v2026.1 rule engine.': 'पूर्णता और सुसंगतता जाँच के लिए दस्तावेज़ों का एआई द्वारा विश्लेषण किया जाता है: PDF पाठ + ओसीआर, SHA-256 जाँच, 2D QR डिकोडिंग, तिथि क्रम, एपीएच v2026.1 नियम इंजन।',
    'Details extracted successfully': 'विवरण सफलतापूर्वक निकाले गए', 'Details matched with FDR form': 'विवरण एफडीआर फ़ॉर्म से मेल खाते हैं', 'Cadre matches declared numbers': 'संवर्ग घोषित संख्या से मेल खाता है',
    'FDR number matches FDR certificate': 'एफडीआर संख्या प्रमाणपत्र से मेल खाती है', 'Institution name & PID coherent across documents': 'सभी दस्तावेज़ों में संस्थान का नाम एवं पीआईडी सुसंगत',
    'No cross-application SHA-256 duplicates': 'अन्य आवेदनों से कोई SHA-256 डुप्लिकेट नहीं', 'All fingerprints unique': 'सभी फ़िंगरप्रिंट अद्वितीय', 'Verified on server across all institutions': 'सभी संस्थानों में सर्वर पर सत्यापित',
    'FDR certificate not uploaded': 'एफडीआर प्रमाणपत्र अपलोड नहीं हुआ', 'Processed': 'संसाधित',
    'Mandatory Document Completeness': 'अनिवार्य दस्तावेज़ पूर्णता', 'Statutory Certificate Expiry Verification': 'वैधानिक प्रमाणपत्र वैधता सत्यापन', 'Permanent Institute ID (PID) Coherence': 'स्थायी संस्थान आईडी (पीआईडी) सुसंगतता',
    'Cross-Application SHA-256 Duplicate Collision': 'अंतर-आवेदन SHA-256 डुप्लिकेट टकराव', 'Faculty-Student & Cadre Ratio Compliance': 'संकाय-छात्र एवं संवर्ग अनुपात अनुपालन',
    'Instructional & Administrative Area Norms': 'शैक्षणिक एवं प्रशासनिक क्षेत्र मानदंड', 'Joint FDR Corpus Fund & Lien Status': 'संयुक्त एफडीआर कोष एवं ग्रहणाधिकार स्थिति',
    'This is an AI-assisted preliminary check. Final verification will be done by AICTE officials. Deterministic rules (v2026.1) and probabilistic AI extraction are kept strictly separate.': 'यह एआई-सहायित प्रारंभिक जाँच है। अंतिम सत्यापन एआईसीटीई अधिकारी करेंगे। नियतात्मक नियम (v2026.1) और एआई निष्कर्षण पूरी तरह अलग रखे जाते हैं।',
    'Advisory — derived from on-device extraction; not a deterministic server rule.': 'सलाहकारी — डिवाइस पर निष्कर्षण से; यह नियतात्मक सर्वर नियम नहीं है।',
    'Type': 'प्रकार', 'Program / Change': 'कार्यक्रम / परिवर्तन', 'Closure': 'बंदी', 'No change from previous year': 'पिछले वर्ष से कोई परिवर्तन नहीं', 'Total Intake': 'कुल प्रवेश',
    'Faculty (P:A:Asst)': 'संकाय (प्रो.:एसो.:सहा.)', 'FDR Amount': 'एफडीआर राशि', 'Bank': 'बैंक',
    'Extension of Approval (EoA)': 'अनुमोदन विस्तार (ईओए)', 'Approval Application (New Programme / Intake)': 'अनुमोदन आवेदन (नया कार्यक्रम / प्रवेश)', 'Change in Program Details / Intake Variation': 'कार्यक्रम विवरण / प्रवेश में परिवर्तन',
    'I hereby declare that the information provided is correct and all documents are genuine. I understand that furnishing false information or re-used documents attracts action under the AICTE Approval Process Handbook.': 'मैं घोषणा करता/करती हूँ कि दी गई जानकारी सही है और सभी दस्तावेज़ वास्तविक हैं। मैं समझता/समझती हूँ कि गलत जानकारी या पुनः उपयोग किए गए दस्तावेज़ देने पर एआईसीटीई अनुमोदन प्रक्रिया पुस्तिका के अंतर्गत कार्रवाई होगी।',
    'AICTE Regulation Bureau': 'एआईसीटीई विनियमन ब्यूरो', 'Reviewer Query': 'समीक्षक का प्रश्न', 'Application Type': 'आवेदन का प्रकार', 'Last Updated': 'अंतिम अद्यतन', 'Version': 'संस्करण',
    'Total Students': 'कुल छात्र', 'Faculty': 'संकाय', 'Calculated SFR': 'परिकलित एसएफआर', 'Cadre Proportion': 'संवर्ग अनुपात', 'Built-up Carpet Area': 'निर्मित कारपेट क्षेत्र', 'FDR Corpus': 'एफडीआर कोष',
    'Queued for Regional Office': 'क्षेत्रीय कार्यालय की कतार में', 'Clarification required': 'स्पष्टीकरण आवश्यक', 'Recommended for approval': 'अनुमोदन हेतु अनुशंसित', 'Action Required — Deficiency Notice': 'कार्रवाई आवश्यक — कमी सूचना',
    'Programme': 'कार्यक्रम', 'Change': 'परिवर्तन', 'Submitted': 'जमा किया गया',
    'eligible for lien release. Institutions must submit renewal receipts 60 days prior to certificate maturity.': 'ग्रहणाधिकार मुक्ति हेतु पात्र। संस्थानों को परिपक्वता से 60 दिन पहले नवीनीकरण रसीद जमा करनी होगी।',
    'Institutions must submit renewal receipts 60 days prior to certificate maturity.': 'संस्थानों को परिपक्वता से 60 दिन पहले नवीनीकरण रसीद जमा करनी होगी।',
    'Fixed Deposit Advice & Lien Certificate': 'सावधि जमा सलाह एवं ग्रहणाधिकार प्रमाणपत्र', 'FDR CERTIFICATE NUMBER': 'एफडीआर प्रमाणपत्र संख्या', 'Principal Deposit Amount': 'मूल जमा राशि',
    'Deposit Horizon & Maturity': 'जमा अवधि एवं परिपक्वता', 'Issuing Bank & Branch': 'जारीकर्ता बैंक एवं शाखा', 'Linked Application': 'संबद्ध आवेदन', 'IRREVOCABLE JOINT LIEN COVENANT': 'अपरिवर्तनीय संयुक्त ग्रहणाधिकार प्रतिज्ञा',
    'Jointly pledged in favour of:': 'संयुक्त रूप से गिरवी, इनके पक्ष में:', '. Non-encashable without council release decree.': '। परिषद के मुक्ति आदेश के बिना भुनाया नहीं जा सकता।', 'Renewal Status': 'नवीनीकरण स्थिति',
    'Supplementary demo record for exercising renewal / release flows.': 'नवीनीकरण / मुक्ति प्रवाह आज़माने हेतु पूरक डेमो रिकॉर्ड।', 'Lien Release Request': 'ग्रहणाधिकार मुक्ति अनुरोध',
    'AICTE Intelligent Regulatory Validation Platform (AI-IRVP) • APH v2026.1 Compliance Engine': 'एआईसीटीई इंटेलिजेंट नियामक सत्यापन प्लेटफ़ॉर्म (एआई-आईआरवीपी) • एपीएच v2026.1 अनुपालन इंजन',
    'Live': 'लाइव', 'Demo data': 'डेमो डेटा', 'Corpus': 'कोष', 'Unread': 'अपठित', 'LIVE': 'लाइव',
    'Documents read by AI': 'एआई द्वारा पढ़े गए दस्तावेज़', 'Server validation unavailable': 'सर्वर सत्यापन उपलब्ध नहीं', 'Retry server validation': 'सर्वर सत्यापन पुनः करें', 'Submitting securely…': 'सुरक्षित रूप से जमा हो रहा है…', 'Opening…': 'खोला जा रहा है…', 'Sending…': 'भेजा जा रहा है…',
  };
  // Dynamic labels: [pattern, replacement(match) ]
  const PATTERNS = [
    [/^Step (\d) of 4 · (.+)$/, m => `चरण ${m[1]} / 4 · ${tr(m[2])}`],
    [/^(\d+)\/(\d+) mandatory$/, m => `${m[1]}/${m[2]} अनिवार्य`],
    [/^All Alerts \((\d+)\)$/, m => `सभी सूचनाएँ (${m[1]})`],
    [/^Unread \((\d+)\)$/, m => `अपठित (${m[1]})`],
    [/^Docs \((\d+)\)$/, m => `दस्तावेज़ (${m[1]})`],
    [/^(\d+) passed$/, m => `${m[1]} उत्तीर्ण`], [/^(\d+) warning$/, m => `${m[1]} चेतावनी`], [/^(\d+) warn$/, m => `${m[1]} चेतावनी`], [/^(\d+) critical$/, m => `${m[1]} गंभीर`],
    [/^(\d+) record\(s\)$/, m => `${m[1]} रिकॉर्ड`], [/^(\d+) days to maturity$/, m => `परिपक्वता में ${m[1]} दिन`],
    [/^Lock-in ([\d.]+) of (\d+) yrs$/, m => `लॉक-इन ${m[2]} में से ${m[1]} वर्ष`], [/^Matured$/, () => 'परिपक्व'],
    [/^Show slide (\d) of (\d)$/, m => `स्लाइड ${m[1]} / ${m[2]} दिखाएँ`],
    [/^Professors \(min (\d+) of (\d+) faculty\)$/, m => `प्रोफ़ेसर (${m[2]} संकाय में न्यूनतम ${m[1]})`],
    [/^Assoc\. Professors \(min (\d+)\)$/, m => `एसो. प्रोफ़ेसर (न्यूनतम ${m[1]})`],
    [/^Built-up area \(min ([\d,]+) sq\.m\)$/, m => `निर्मित क्षेत्र (न्यूनतम ${m[1]} वर्ग मी.)`],
    [/^Issued (.+) · Matures (.+)$/, m => `जारी ${m[1]} · परिपक्वता ${m[2]}`],
    [/^Deposit amount ≥ required corpus \((.+)\)$/, m => `जमा राशि ≥ आवश्यक कोष (${m[1]})`],
    [/^([\d.]+ (?:Cr|Lakhs)) declared$/, m => `${m[1]} घोषित`], [/^(\d+) days remaining$/, m => `${m[1]} दिन शेष`], [/^Token (.+)$/, m => `टोकन ${m[1]}`],
    [/^Documents Uploaded \((\d+)\/(\d+)\)$/, m => `अपलोड किए गए दस्तावेज़ (${m[1]}/${m[2]})`],
    [/^Submitted (\d.+)$/, m => `जमा: ${m[1]}`], [/^Saved (.+) · Step (\d) of 4$/, m => `सहेजा गया ${m[1]} · चरण ${m[2]} / 4`],
    [/^(\d+) rules? evaluated$/, m => `${m[1]} नियमों का मूल्यांकन`], [/^(\d+) ticket\(s\)$/, m => `${m[1]} टिकट`],
    [/^([\d.]+ (?:Cr|Lakhs)) · (\d+) deposit\(s\)$/, m => `${m[1]} · ${m[2]} जमा`],
    [/^([\d.]+ (?:Cr|Lakhs)) · (\d+) active deposit\(s\) · APH Chapter VI$/, m => `${m[1]} · ${m[2]} सक्रिय जमा · एपीएच अध्याय VI`],
    [/^(\d+) (Active \(Lien Secured\)|Expiring Soon|Matured \(10-Yr Met\)|Under Verification|Lien Released)$/, m => `${m[1]} ${HI[m[2]]}`],
    [/^(\d+) FDR\(s\) due for renewal\.$/, m => `${m[1]} एफडीआर नवीनीकरण हेतु देय।`], [/^(\d+) matured FDR\(s\)$/, m => `${m[1]} परिपक्व एफडीआर`],
    [/^([\d.]+ (?:Cr|Lakhs)) secured under AICTE joint lien$/, m => `${m[1]} एआईसीटीई संयुक्त ग्रहणाधिकार के अंतर्गत सुरक्षित`],
    [/^(\d+) application\(s\) under review$/, m => `${m[1]} आवेदन समीक्षाधीन`], [/^(\d+) clarification\(s\) required$/, m => `${m[1]} स्पष्टीकरण आवश्यक`],
    [/^(\d+) unread alert\(s\)$/, m => `${m[1]} अपठित सूचनाएँ`], [/^Next maturity: (.+)$/, m => `अगली परिपक्वता: ${m[1]}`],
    [/^Updated (\d{1,2}:\d{2}\s*(?:am|pm)?)$/i, m => `अद्यतन ${m[1]}`], [/^Could not refresh: (.+)$/, m => `ताज़ा नहीं हो सका: ${m[1]}`],
    [/^Matures (\d.+)$/, m => `परिपक्वता ${m[1]}`], [/^(\d+) point\(s\)$/, m => `${m[1]} बिंदु`],
    [/^([\d.]+ (?:Cr|Lakhs)) · (\d+) active deposit\(s\) · APH Chapter VI Norms$/, m => `${m[1]} · ${m[2]} सक्रिय जमा · एपीएच अध्याय VI मानदंड`],
    [/^Endorsed (.+)$/, m => `पृष्ठांकित ${m[1]}`], [/^(\d+) point\(s\) raised by (.+)\. Respond within 7 working days\.$/, m => `${m[2]} द्वारा ${m[1]} बिंदु उठाए गए। 7 कार्य दिवसों में उत्तर दें।`],
  ];
  let lang = (() => { try { return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en'; } catch (e) { return 'en'; } })();
  let observer = null;

  function tr(s) {
    if (lang !== 'hi') return s;
    const k = s.replace(/\s+/g, ' ').trim();
    if (!k || !/[A-Za-z]/.test(k)) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    if (HI[k]) return lead + HI[k] + trail;
    for (const [re, fn] of PATTERNS) { const m = re.exec(k); if (m) return lead + fn(m) + trail; }
    return s;
  }
  const skip = el => !!(el && el.closest && el.closest('[translate="no"], script, style, .mono, .letter, input, textarea'));
  function apply(root) {
    if (lang !== 'hi' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) { if (!skip(n.parentElement)) { const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; } }
    const els = root.querySelectorAll ? root.querySelectorAll('[placeholder], [aria-label]') : [];
    for (const el of els) {
      if (skip(el.parentElement)) continue;
      for (const a of ['placeholder', 'aria-label']) { const v = el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
    }
  }
  function watch() {
    if (observer) observer.disconnect();
    if (lang !== 'hi') return;
    observer = new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) { if (n.nodeType === 1) apply(n); else if (n.nodeType === 3 && !skip(n.parentElement)) { const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; } } });
    observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  }
  function set(next) {
    lang = next === 'hi' ? 'hi' : 'en';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }
    document.documentElement.lang = lang;
    watch();
  }
  document.documentElement.lang = lang;
  watch();   // #app already exists (scripts load at the end of <body>); app.js renders after this
  document.addEventListener('DOMContentLoaded', () => apply(document.getElementById('app')));
  return { get lang() { return lang; }, set, apply, tr };
})();
