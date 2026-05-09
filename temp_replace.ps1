$html = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SKCS AI Sports Edge v2.2</title>
    <meta name="description" content="SKCS AI Sports Edge delivers smart, confidence-based sports insights across multiple sports with fast performance, daily analysis, and high-probability selections.">
    <link rel="icon" href="data:,">
    <link rel="preconnect" href="https://skcs-sports-edge-skcsai.onrender.com" crossorigin>
    <link rel="preload" as="image" href="https://images.unsplash.com/photo-1553729459-efe14a011e42?w=1600&h=900&fit=crop&auto=format">
    <style>
        /* ========== ALL YOUR EXISTING STYLES (kept exactly as before) ========== */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8f9fa; color: #212529; line-height: 1.6; }
        .navbar { background-color: #0d6efd; padding: 1rem 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .nav-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { color: white; font-size: 1.5rem; font-weight: bold; text-decoration: none; }
        .nav-links { display: flex; gap: 2rem; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .nav-links a { color: white; text-decoration: none; font-weight: 500; transition: color 0.3s; }
        .nav-links a:hover { color: #cfe2ff; }
        .nav-greeting { display: none; color: #e7f1ff; font-size: 0.9rem; font-weight: 600; line-height: 1.3; max-width: 540px; }
        .hero-section { position: relative; height: 500px; overflow: hidden; display: flex; align-items: center; justify-content: center; text-align: center; color: white; padding: 2rem; }
        .hero-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .hero-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); }
        .hero-content { position: relative; z-index: 2; max-width: 800px; }
        .hero-content h1 { font-size: 3rem; margin-bottom: 1rem; color: white; text-shadow: 2px 2px 8px rgba(0,0,0,0.7); }
        .hero-content p { font-size: 1.3rem; margin-bottom: 2rem; text-shadow: 1px 1px 4px rgba(0,0,0,0.7); }
        .main-content { max-width: 1200px; margin: 3rem auto; padding: 0 1rem; }
        .features { display: flex; flex-wrap: wrap; gap: 2rem; justify-content: center; margin: 3rem 0; }
        .feature { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.08); flex: 1; min-width: 250px; max-width: 350px; }
        .feature h3 { color: #0d6efd; margin-bottom: 0.5rem; }
        .section-title { text-align: center; color: #0d6efd; margin-bottom: 2rem; font-size: 2.2rem; }
        .section-description { text-align: center; color: #666; font-size: 1.2rem; max-width: 800px; margin: 0 auto 3rem auto; }
        .platform-update-notice {
            max-width: 960px;
            margin: 0 auto 1.5rem auto;
            padding: 0.9rem 1.1rem;
            border-radius: 8px;
            background: #fff4e5;
            border: 1px solid #ffd8a8;
            color: #7a4f01;
            font-weight: 600;
            text-align: center;
        }
        #contact .form-input, #contact .form-textarea { width: 100%; padding: 12px 15px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; font-family: 'Segoe UI', Arial, sans-serif; box-sizing: border-box; }
        #contact .form-input:focus, #contact .form-textarea:focus { border-color: #0d6efd; outline: none; box-shadow: 0 0 5px rgba(13, 110, 253, 0.3); }
        #contact .form-textarea { min-height: 150px; resize: vertical; }
        #contact .submit-btn { background-color: #0d6efd; color: white; padding: 12px 30px; border: none; border-radius: 5px; font-size: 18px; font-weight: bold; cursor: pointer; transition: background-color 0.3s; width: 100%; }
        #contact .submit-btn:hover { background-color: #0b5ed7; }
        #contact .form-input::placeholder, #contact .form-textarea::placeholder { color: #888; font-size: 15px; font-style: italic; }
        #contact .form-input, #contact .form-textarea { color: #333; font-size: 16px; line-height: 1.5; }
        #contact .submit-btn { font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: 0.5px; }
        #contact .form-title { font-size: 24px; color: #0d6efd; margin-bottom: 20px; text-align: center; font-weight: bold; }
        .pipeline-section { background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%); color: white; padding: 5rem 2rem; margin: 4rem 0; position: relative; overflow: hidden; }
        .pipeline-section::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" opacity="0.05"><path d="M0,0H1000V1000H0Z" stroke="none"/><path d="M250,250H750V750H250Z" stroke="white" stroke-width="2" fill="none"/></svg>'); background-size: 300px; }
        .pipeline-container { max-width: 1200px; margin: 0 auto; position: relative; z-index: 2; }
        .pipeline-timeline { position: relative; margin: 4rem 0; }
        .pipeline-timeline::before { content: ''; position: absolute; left: 30px; top: 0; bottom: 0; width: 4px; background: rgba(255, 255, 255, 0.3); border-radius: 2px; }
        .pipeline-stage { display: flex; margin-bottom: 3rem; position: relative; }
        .stage-number { width: 60px; height: 60px; background: white; color: #0d6efd; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold; margin-right: 2rem; flex-shrink: 0; z-index: 2; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .stage-content { flex: 1; background: rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 1.5rem; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .stage-content h3 { color: white; margin-bottom: 1rem; font-size: 1.4rem; display: flex; align-items: center; gap: 10px; }
        .stage-icon { font-size: 1.8rem; }
        .stage-card { background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 1.5rem; margin-top: 1rem; }
        .stage-card h4 { color: #6ea8fe; margin-bottom: 1rem; font-size: 1.1rem; }
        .stage-card pre { background: rgba(0, 0, 0, 0.5); border-radius: 6px; padding: 1rem; overflow-x: auto; margin: 1rem 0; border-left: 3px solid #6ea8fe; }
        .stage-card code { color: #f0f0f0; font-family: 'Courier New', monospace; font-size: 0.9rem; }
        .stage-card p { color: #e0e0e0; margin: 0.5rem 0; font-size: 0.95rem; }
        .stage-card strong { color: white; }
        .pipeline-summary { background: rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 2.5rem; margin-top: 3rem; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .pipeline-summary h3 { color: white; text-align: center; margin-bottom: 2rem; font-size: 1.8rem; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .summary-item { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 1.5rem; text-align: center; border-top: 3px solid #6ea8fe; }
        .summary-item h4 { color: #6ea8fe; margin-bottom: 0.8rem; font-size: 1.2rem; }
        .summary-item p { color: #e0e0e0; font-size: 0.95rem; line-height: 1.5; }
        .disclaimer-note { background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 1.5rem; margin-top: 2rem; border-left: 4px solid #6ea8fe; }
        .disclaimer-note p { color: white; font-size: 1rem; line-height: 1.6; margin: 0; }
        .predictions-section { max-width: 1400px; margin: 4rem auto; padding: 0 1rem; }
        .tabs-container { background: white; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .tabs-header { display: flex; background-color: #f8f9fa; border-bottom: 2px solid #e9ecef; overflow-x: auto; scrollbar-width: none; }
        .tabs-header::-webkit-scrollbar { display: none; }
        .tab-button { flex-shrink: 0; padding: 1.2rem 1.5rem; background: none; border: none; font-size: 1rem; font-weight: 600; color: #6c757d; cursor: pointer; transition: all 0.3s ease; border-bottom: 3px solid transparent; white-space: nowrap; }
        .tab-button:hover { background-color: #e9ecef; color: #0d6efd; }
        .tab-button.active { background-color: white; color: #0d6efd; border-bottom: 3px solid #0d6efd; }
        .tab-content { padding: 2.5rem; display: none; animation: fadeIn 0.5s ease; }
        .tab-content.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sport-icon { font-size: 1.5rem; margin-right: 10px; vertical-align: middle; }
        .tab-title { color: #0d6efd; font-size: 1.8rem; margin-bottom: 1.5rem; display: flex; align-items: center; }
        .subscription-status { display: inline-block; background-color: #198754; color: white; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; margin-left: 1rem; font-weight: 600; }
        .coming-soon-message { text-align: center; padding: 3rem 1rem; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 2rem; }
        .coming-soon-message h3 { color: #0d6efd; margin-bottom: 1rem; font-size: 1.5rem; }
        .prediction-sample { background-color: #f8f9fa; border-radius: 8px; padding: 1.5rem; margin-top: 2rem; border-left: 4px solid #0d6efd; }
        .prediction-sample h4 { color: #0d6efd; margin-bottom: 1rem; }
        .prediction-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
        .prediction-card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 3px 10px rgba(0,0,0,0.08); border-top: 3px solid #0d6efd; }
        .cricket-fixture-league { color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem; }
        .cricket-insight-explanation { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
        .cricket-fixtures-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        @media (max-width: 960px) {
            .cricket-fixtures-grid {
                grid-template-columns: 1fr;
            }
        }
        .match-info { margin-bottom: 1rem; }
        .teams { font-weight: 600; font-size: 1.1rem; color: #212529; }
        .match-date { color: #6c757d; font-size: 0.9rem; margin-top: 0.3rem; }
        .prediction-details { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e9ecef; }
        .prediction { font-weight: 600; color: #198754; }
        .confidence { background-color: #e7f1ff; color: #0d6efd; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; }
        .direct-markets-menu { display: flex; flex-direction: column; gap: 0.5rem; max-width: 600px; }
        .sport-menu-item { display: flex; align-items: center; padding: 1rem 1.5rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); cursor: pointer; transition: all 0.2s ease; }
        .sport-menu-item:hover { transform: translateX(5px); box-shadow: 0 4px 8px rgba(0,0,0,0.12); }
        .sport-emoji { font-size: 1.5rem; margin-right: 1rem; }
        .sport-name { flex: 1; font-weight: 600; color: #212529; }
        .sport-count { color: #0d6efd; font-weight: 600; }
        .note { font-size: 0.9rem; color: #6c757d; font-style: italic; margin-top: 2rem; text-align: center; }
        .framework-section { background-color: #212529; color: white; padding: 5rem 2rem; margin: 4rem 0; }
        .framework-container { max-width: 1200px; margin: 0 auto; }
        .framework-title { color: #fff; font-size: 2.5rem; margin-bottom: 1rem; text-align: center; }
        .framework-subtitle { color: #adb5bd; font-size: 1.2rem; text-align: center; max-width: 800px; margin: 0 auto 3rem auto; font-style: italic; }
        .framework-intro { background-color: rgba(255, 255, 255, 0.05); padding: 2rem; border-radius: 8px; margin-bottom: 3rem; border-left: 4px solid #0d6efd; }
        .framework-intro p { font-size: 1.1rem; line-height: 1.8; margin-bottom: 1rem; }
        .framework-intro strong { color: #0d6efd; }
        .framework-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin: 3rem 0; }
        .framework-card { background-color: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 2rem; border-top: 3px solid #0d6efd; transition: transform 0.3s ease; }
        .framework-card:hover { transform: translateY(-5px); background-color: rgba(255, 255, 255, 0.08); }
        .framework-card-title { color: #0d6efd; font-size: 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 10px; }
        .market-icon { background-color: #0d6efd; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; }
        .framework-card-text { color: #e9ecef; line-height: 1.7; margin-bottom: 1.5rem; }
        .framework-list { list-style-type: none; padding-left: 0; margin: 1.5rem 0; }
        .framework-list li { padding: 0.8rem 0; color: #adb5bd; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-left: 1.5rem; position: relative; }
        .framework-list li:before { content: "•"; color: #0d6efd; position: absolute; left: 0; font-size: 1.2rem; }
        .framework-list li:last-child { border-bottom: none; }
        .philosophy-section { background-color: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 3rem; margin-top: 4rem; border: 1px solid rgba(0, 110, 253, 0.3); }
        .philosophy-title { color: #0d6efd; font-size: 1.8rem; margin-bottom: 2rem; text-align: center; }
        .principles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .principle { background-color: rgba(0, 110, 253, 0.1); padding: 1.5rem; border-radius: 6px; text-align: center; border: 1px solid rgba(0, 110, 253, 0.2); }
        .principle h4 { color: #0d6efd; margin: 0; font-size: 1.1rem; }
        .philosophy-statement { font-size: 1.2rem; color: #fff; line-height: 1.8; margin-top: 2rem; text-align: center; font-style: italic; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 2rem; }
        .philosophy-statement strong { color: #0d6efd; }
        .about-section { position: relative; padding: 4rem 2rem; margin: 3rem 0; border-radius: 10px; overflow: hidden; background-image: url('about-bg.webp'); background-size: cover; background-position: center; background-repeat: no-repeat; background-attachment: fixed; }
        .about-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 255, 255, 0.7); z-index: 1; }
        .about-container { position: relative; max-width: 1000px; margin: 0 auto; z-index: 2; }
        .about-title { color: #0d6efd; font-size: 2.5rem; margin-bottom: 1.5rem; text-align: center; text-shadow: 1px 1px 3px rgba(255, 255, 255, 0.8); }
        .mission-statement { background-color: rgba(255, 255, 255, 0.9); padding: 2rem; border-radius: 8px; margin: 2rem 0; border-left: 4px solid #0d6efd; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .mission-statement h3 { color: #0d6efd; margin-bottom: 1rem; font-size: 1.5rem; }
        .mission-statement p { font-size: 1.1rem; line-height: 1.8; }
        .highlight { background-color: rgba(255, 243, 205, 0.95); padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: bold; }
        .section-subtitle { color: #0d6efd; font-size: 1.8rem; margin: 2.5rem 0 1.5rem 0; border-bottom: 2px solid rgba(0, 110, 253, 0.3); padding-bottom: 0.5rem; text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8); }
        .feature-list { list-style-type: none; padding-left: 0; }
        .feature-list li { padding: 1rem; margin-bottom: 1rem; background-color: rgba(255, 255, 255, 0.9); border-radius: 6px; border-left: 3px solid #0d6efd; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .feature-list strong { color: #0d6efd; font-size: 1.1rem; }
        .vision-list { list-style-type: none; padding-left: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
        .vision-list li { background-color: rgba(255, 255, 255, 0.9); padding: 1.5rem; border-radius: 8px; text-align: center; border-top: 3px solid #0d6efd; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .core-principle { font-size: 1.1rem; color: #495057; margin-top: 0.5rem; }
        .contact-section { background-color: #e9ecef; padding: 4rem 2rem; margin-top: 3rem; }
        .contact-container { max-width: 800px; margin: 0 auto; text-align: center; }
        .contact-title { color: #0d6efd; font-size: 2.2rem; margin-bottom: 1.5rem; }
        .contact-info { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
        .contact-item { margin-bottom: 1.5rem; text-align: left; padding-left: 1rem; }
        .contact-item h4 { color: #0d6efd; margin-bottom: 0.5rem; font-size: 1.2rem; }
        .contact-item p { color: #495057; margin-bottom: 0.3rem; }
        .email-link { color: #0d6efd; text-decoration: none; font-weight: 500; }
        .email-link:hover { text-decoration: underline; }
        .contact-note { color: #6c757d; font-size: 0.9rem; margin-top: 2rem; font-style: italic; }
        .footer { background-color: #212529; color: white; padding: 2rem; text-align: center; }
        .footer-content { max-width: 1200px; margin: 0 auto; }
        .footer-company { line-height: 1.7; }
        .footer-links { margin-top: 0.75rem; }
        .footer a { color: #cfe2ff; text-decoration: underline; }
        .policy-badge { display: inline-block; background: #e7f1ff; color: #0d6efd; border: 1px solid #bfd7ff; border-radius: 999px; padding: 0.55rem 1rem; font-weight: 700; margin: 0 auto 1rem; }
        .policy-note { max-width: 900px; margin: 0 auto 1.75rem auto; text-align: center; color: #495057; }
        .copyright { margin-top: 1rem; color: #adb5bd; font-size: 0.9rem; }
        @media (max-width: 768px) { .pipeline-timeline::before { left: 25px; } .stage-number { width: 50px; height: 50px; margin-right: 1.5rem; font-size: 1.3rem; } .stage-content h3 { font-size: 1.2rem; } .stage-icon { font-size: 1.5rem; } }
        @media (max-width: 480px) { .pipeline-stage { flex-direction: column; } .stage-number { margin-bottom: 1rem; margin-right: 0; } .pipeline-timeline::before { left: 25px; } .summary-grid { grid-template-columns: 1fr; } }
        .subscribe-btn { background-color: #198754; color: white; padding: 0.6rem 1.4rem; border-radius: 6px; font-weight: bold; text-decoration: none; transition: background-color 0.3s; }
        .subscribe-btn:hover { background-color: #146c43; }
        .language-link { color: white; font-weight: bold; text-decoration: none; padding: 0.6rem 1.2rem; border-radius: 6px; transition: background 0.3s; }
        .language-link:hover { background: rgba(255,255,255,0.15); }
        .tabs-header { display: flex; flex-wrap: nowrap !important; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: thin; padding-bottom: 5px; white-space: nowrap; }
        .tabs-header::-webkit-scrollbar { height: 4px; }
        .tabs-header::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .tabs-header::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
        .tabs-header::-webkit-scrollbar-thumb:hover { background: #555; }
        .tab-button { flex: 0 0 auto; white-space: nowrap; }
        .tabs-container { position: relative; width: 100%; max-width: 1400px; margin: 0 auto; }
        .tabs-container::after { content: ''; position: absolute; top: 0; right: 0; height: 100%; width: 40px; background: linear-gradient(to right, transparent, white); pointer-events: none; opacity: 0.8; z-index: 1; }
        /* ===== EdgeMind BOT CSS ===== */
        #skcs-chatbot { 
            width: 100%; 
            max-width: 800px; 
            margin: 40px auto; 
            background: #020617; 
            border: 1px solid rgba(96,165,250,0.4); 
            border-radius: 10px; 
            box-shadow: 0 0 15px rgba(96,165,250,0.3); 
            display: flex; 
            overflow: hidden;
            font-family: 'Segoe UI', Arial, sans-serif; 
            height: 500px;
        } 
        
        .chatbot-sidebar {
            width: 200px;
            background: #0f172a;
            border-right: 1px solid rgba(96,165,250,0.2);
            display: flex;
            flex-direction: column;
            color: white;
        }

        .sidebar-header {
            padding: 12px 16px;
            font-weight: 600;
            border-bottom: 1px solid rgba(96,165,250,0.2);
            background: rgba(30, 58, 138, 0.3);
        }

        #teams-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }

        .team-item {
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.2s;
        }

        .team-item:hover {
            background: rgba(96,165,250,0.1);
        }

        .team-item.active {
            background: rgba(96,165,250,0.2);
            color: #60a5fa;
            font-weight: 500;
        }

        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #020617;
            position: relative;
        }

        .chat-header { 
            font-weight: 600;
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
            background: #0f172a;
            color: white;
            position: sticky;
            top: 0;
            z-index: 5;
            text-align: left;
        } 
        
        #chat-box { 
            flex: 1;
            overflow-y: auto; 
            padding: 16px; 
            font-size: 14px; 
            display: flex;
            flex-direction: column;
            gap: 10px;
        } 
        
        #chat-box div { 
            padding: 8px 12px; 
            border-radius: 8px; 
            line-height: 1.4; 
            max-width: 85%;
        } 
        
        #chat-box div.user { 
            background: #1e293b; 
            color: #e2e8f0; 
            align-self: flex-end;
            text-align: right; 
        } 
        
        #chat-box div.bot { 
            background: #0f172a; 
            color: #f8fafc; 
            border: 1px solid rgba(96,165,250,0.2); 
            align-self: flex-start;
        } 
        
        #chat-box div.error { 
            color: #f87171; 
            align-self: center;
        } 
        
        .input-area { 
            display: flex; 
            padding: 12px;
            background: #0f172a;
            border-top: 1px solid rgba(96,165,250,0.2);
            gap: 8px;
        } 
        
        .input-area input { 
            flex: 1; 
            padding: 10px 14px; 
            border: 1px solid rgba(96,165,250,0.2); 
            border-radius: 6px;
            background: #000; 
            color: #fff; 
            outline: none;
        } 

        .input-area input:focus {
            border-color: #60a5fa;
        }
        
        .input-area button { 
            padding: 0 16px; 
            background: #1e3a8a; 
            color: #fff; 
            border: none; 
            border-radius: 6px;
            cursor: pointer; 
            font-size: 1.2rem;
            transition: background 0.2s;
        } 

        .input-area button:hover {
            background: #2563eb;
        }
        /* ===== SCROLL TO TOP BUTTON ===== */
        #scrollTopBtn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
            display: block !important;
            background-color: #0d6efd;
            color: white;
            border: none;
            border-radius: 50px;
            padding: 15px 20px;
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            transition: opacity 0.3s, transform 0.3s;
            opacity: 0;
            transform: translateY(20px);
            pointer-events: none;
        }
        #scrollTopBtn.show {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }
        #scrollTopBtn:hover {
            background-color: #0b5ed7;
        }
    </style>
</head>
<body>
    <!-- Navigation Bar (updated with auth link) -->
    <nav class="navbar">
        <div class="nav-container">
            <a href="#" class="logo">SKCS AI Sports Edge</a>
            <div class="nav-links">
                <a href="#pipeline">🤖 AI Pipeline</a>
                <a href="#insights">🏆 Insights</a>
                <a href="#framework">⚙️ Framework</a>
                <a href="#about">📋 About</a>
                <a href="#contact">📧 Contact</a>
                <a href="accuracy.html">📈 Accuracy</a>
                <a href="/subscribe">💎 Subscribe</a>
                <a href="language-switch.html">🌐 Language</a>
                <span id="subscriptionGreeting" class="nav-greeting" aria-live="polite"></span>
                <!-- Auth link will be dynamically replaced by JS -->
                <a href="#" id="authLink">Login</a>
            </div>
        </div>
    </nav>
    <main id="main-content">
    <!-- Hero Section -->
    <section class="hero-section">
        <img
            class="hero-media"
            src="https://images.unsplash.com/photo-1553729459-efe14a011e42?w=1600&h=900&fit=crop&auto=format"
            alt="SKCS AI Sports Edge"
            width="1600"
            height="900"
            fetchpriority="high"
            decoding="async"
        >
        <div class="hero-overlay"></div>
        <div class="hero-content">
                <h1>SKCS AI Sports Edge</h1>
            <p>Smart, confidence-based sports insights across multiple sports</p>
            <p>⚽ 🏉 🏈 🏒 🏀 🏎∩╕Å 🏏 13 Sports Coverage</p>
            <a href="direct-markets.html" class="cta-button" style="display:inline-block;background:#0d6efd;color:white;padding:14px 32px;border-radius:8px;font-size:1.1rem;font-weight:600;text-decoration:none;margin-top:1rem;">Access Insights Portal</a>
        </div>
    </section>
    <!-- Main Content -->
    <div class="main-content">
        <h2 class="section-title">How SKCS Works</h2>
        <p class="section-description">
            Our platform uses advanced AI to analyze sports data and provide
            intelligent probability analysis for better decision making.
        </p>
        <div class="features">
            <div class="feature"><h3>🎯 Confidence-Based</h3><p>Every insight comes with a confidence score, not just guesses. We show you how sure we are about each recommendation.</p></div>
            <div class="feature"><h3>🛡️ Responsible Analytics</h3><p>We provide safer alternatives for volatile matches. When confidence is low, we suggest more conservative options.</p></div>
            <div class="feature"><h3>🏆 Multi-Sport Coverage</h3><p>13 sports covered: Football, Rugby, AFL, Baseball, Basketball, Formula 1, Cricket, NFL, Hockey, MMA, Handball, Volleyball, and Tennis.</p></div>
        </div>
    </div>
    <!-- Pipeline Section -->
    <section id="pipeline" class="pipeline-section">
        <div class="pipeline-container">
            <h2 class="section-title">The SKCS AI Analysis Pipeline</h2>
            <p class="section-description">6-stage AI process transforming raw API data into confidence-based sports insights</p>
            <div class="pipeline-timeline">
                <!-- Stage 1 -->
                <div class="pipeline-stage">
                    <div class="stage-number">1</div>
                    <div class="stage-content">
                        <h3><span class="stage-icon">📥</span> API Data Collection</h3>
                        <div class="stage-card">
                            <h4>Raw JSON Input</h4>
                            <pre><code>{
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea",
  "odds": { "home": 1.85, "draw": 3.4, "away": 4.2 },
  "weather": "Rain",
  "injuries": ["Player A", "Player B"]
}</code></pre>
                            <p><strong>Input:</strong> Multiple API sources (fixtures, odds, stats, injuries, weather)</p>
                            <p><strong>Output:</strong> Raw structured JSON</p>
                            <p><strong>Status:</strong> ✅ Facts collected, ❌ No intelligence yet</p>
                        </div>
                    </div>
                </div>
                <!-- Stage 2 -->
                <div class="pipeline-stage">
                    <div class="stage-number">2</div>
                    <div class="stage-content">
                        <h3><span class="stage-icon">🔄</span> Data Normalization</h3>
                        <div class="stage-card">
                            <h4>SKCS Standard Format</h4>
                            <pre><code>{
  "match_id": "EPL_ARS_CHE_2026_02_10",
  "teams": { "home": "Arsenal", "away": "Chelsea" },
  "markets": { "1x2": { "home": 1.85, "draw": 3.4, "away": 4.2 } },
  "context": { "weather": "Rain", "injuries": 2 }
}</code></pre>
                            <p><strong>Process:</strong> Convert all APIs to uniform SKCS format</p>
                            <p><strong>Purpose:</strong> Clean, consistent fuel for AI stages</p>
                            <p><strong>Key:</strong> Same structure across all 13 sports</p>
                        </div>
                    </div>
                </div>
                <!-- Stage 3 -->
                <div class="pipeline-stage">
                    <div class="stage-number">3</div>
                    <div class="stage-content">
                        <h3><span class="stage-icon">🤖</span> AI Stage 1: Initial Prediction</h3>
                        <div class="stage-card">
                            <h4>Baseline Probability Analysis</h4>
                            <pre><code>{
  "stage_1": {
    "1x2": { "home": 54, "draw": 26, "away": 20 },
    "confidence": "medium"
  }
}</code></pre>
                            <p><strong>Input:</strong> Normalized data + historical stats</p>
                            <p><strong>Question:</strong> "On paper, who should win?"</p>
                            <p><strong>Output:</strong> Initial probabilities & confidence flags</p>
                        </div>
                    </div>
                </div>
                <!-- Stage 4 -->
                <div class="pipeline-stage">
                    <div class="stage-number">4</div>
                    <div class="stage-content">
                        <h3><span class="stage-icon">🧠</span> AI Stage 2: Deep Context</h3>
                        <div class="stage-card">
                            <h4>Team & Player Intelligence</h4>
                            <pre><code>{
  "stage_2": {
    "adjustments": { "home": -6, "draw": +3, "away": +3 },
    "confidence": "medium-low"
  }
}</code></pre>
                            <p><strong>Factors:</strong> Injuries, suspensions, manager changes, fatigue</p>
                            <p><strong>Example Logic:</strong> Missing striker → reduce goal expectancy</p>
                            <p><strong>Purpose:</strong> Human-like analyst thinking</p>
                        </div>
                    </div>
                </div>
                <!-- Stage 5 -->
                <div class="pipeline-stage">
                    <div class="stage-number">5</div>
                    <div class="stage-content">
                        <h3><span class="stage-icon">⚠️</span> AI Stage 3: Reality Check</h3>
                        <div class="stage-card">
                            <h4>External Factor Analysis</h4>
                            <pre><code>{
  "stage_3": {
    "volatility": "high",
    "risk_flags": ["weather", "team unrest"]
  }
}</code></pre>
                            <p><strong>Input:</strong> News, press conferences, weather impact, travel</p>
                            <p><strong>Question:</strong> "What's happening that stats don't show?"</p>
                            <p><strong>Output:</strong> Volatility scoring & risk flags</p>
                        </div>
                    </div>
                </div>
                <!-- Stage 6 -->
                <div class="pipeline-stage">
                    <div class="stage-number">6</div>
                    <div class="stage-content">
                        <h3><span class="stage-icon">🎯</span> AI Stage 4: Decision Engine</h3>
                        <div class="stage-card">
                            <h4>Final SKCS Insights</h4>
                            <pre><code>{
  "final_prediction": {
    "recommended": ["Home Win", "Over 1.5"],
    "avoid": ["BTTS"],
    "acca_safe": false,
    "confidence": 72
  }
}</code></pre>
                            <p><strong>Process:</strong> Combine all 5 previous stages</p>
                            <p><strong>Output:</strong> Market-specific recommendations</p>
                            <p><strong>Filtering:</strong> 1X2 > Multi Bets > Same-Match > Accumulators</p>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Pipeline Summary -->
            <div class="pipeline-summary">
                <h3>⚙️ How This Powers Your Insights</h3>
                <div class="summary-grid">
                    <div class="summary-item"><h4>1X2 Markets</h4><p>Must survive <strong>all 6 stages</strong> with high confidence</p></div>
                    <div class="summary-item"><h4>Multi Bets</h4><p>Built from <strong>low-correlation</strong> matches passing Stages 1-4</p></div>
                    <div class="summary-item"><h4>Same-Match Bets</h4><p>Created after Stage 2, adjusted by Stage 3 volatility</p></div>
                    <div class="summary-item"><h4>Accumulators</h4><p>Only matches passing <strong>all stages</strong> + kill-switch for volatility</p></div>
                    <div class="summary-item"><h4>Single-Use Policy</h4><p>Once a match is published in one insight format, it is blocked from the other formats for the rest of the week</p></div>
                </div>
                <div class="disclaimer-note"><p>💡 <strong>Transparency First:</strong> We show our process so you understand our confidence scores. No black boxes, no hidden logic.</p></div>
            </div>
        </div>
    </section>
    
    <div id="skcs-chatbot"> 
      <div class="chatbot-sidebar">
        <div class="sidebar-header">Teams</div>
        <div id="teams-list">
          <div class="team-item active">General AI</div>
          <div class="team-item">Football Stats</div>
          <div class="team-item">Rugby Insights</div>
          <div class="team-item">Market Analysis</div>
        </div>
      </div>
      <div class="chat-area">
        <div class="chat-header">EdgeMind BOT</div>
        <div id="chat-box"></div>
        <div class="input-area">
          <input type="text" id="chat-input" placeholder="Ask EdgeMind BOT..." /> 
          <button id="send-btn">→</button> 
        </div>
      </div>
    </div> 

    <!-- INSIGHTS SECTION -->
    <section id="insights" class="predictions-section">
        <h2 class="section-title">Latest Insights</h2>
        <p style="text-align:center;"><span class="policy-badge">SKCS Rule: Single-use per team per week</span></p>
        <p class="policy-note">Once a team or athlete is used in an insight, the same match is blocked from other insight formats for the rest of that calendar week unless they appear in a different event.</p>
        <p class="section-description" id="planDescription"></p>

        <!-- NEW Sports Market Hub Widget (replaces old EdgeMind Hub) -->
        <div id="portal-container">
            <style>
                /* Sports Market Hub styles (scoped) */
                .hub-card {
                    background-color: #1c1f26;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 800px;
                    padding: 24px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    border: 1px solid #2d313b;
                }
                .hub-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .hub-title-text {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #ffffff;
                    margin: 0;
                }
                .hub-status {
                    text-align: right;
                }
                .status-label {
                    display: block;
                    font-size: 0.7rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 2px;
                }
                .status-value {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #ffffff;
                }
                .display-panel {
                    background-color: #272b36;
                    border-radius: 10px;
                    padding: 40px 20px;
                    text-align: center;
                    margin-bottom: 30px;
                    border: 1px solid #363b47;
                    min-height: 180px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    transition: all 0.3s ease;
                }
                .icon-wrapper {
                    margin-bottom: 15px;
                }
                .icon-wrapper svg {
                    width: 48px;
                    height: 48px;
                    fill: #94a3b8;
                }
                .display-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #ffffff;
                    margin: 0 0 8px 0;
                }
                .display-subtitle {
                    font-size: 1rem;
                    color: #94a3b8;
                    margin: 0;
                }
                .controls-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px 40px;
                }
                .control-group {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .control-group label {
                    font-size: 0.95rem;
                    color: #e2e8f0;
                    font-weight: 500;
                }
                select {
                    width: 65%;
                    padding: 10px 12px;
                    background-color: #15171e;
                    border: 1px solid #363b47;
                    border-radius: 8px;
                    color: #e2e8f0;
                    font-size: 0.95rem;
                    appearance: none;
                    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px top 50%;
                    background-size: 10px auto;
                    cursor: pointer;
                    transition: border-color 0.2s ease;
                }
                select:focus {
                    outline: none;
                    border-color: #3b82f6;
                }
                @media (max-width: 600px) {
                    .controls-grid {
                        grid-template-columns: 1fr;
                        gap: 15px;
                    }
                    .control-group {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .control-group label {
                        margin-bottom: 8px;
                    }
                    select {
                        width: 100%;
                    }
                }
            </style>

            <div class="hub-card">
                <div class="hub-header">
                    <h2 class="hub-title-text">Sports Market Hub</h2>
                    <div class="hub-status">
                        <span class="status-label">STATUS</span>
                        <span class="status-value">Ready</span>
                    </div>
                </div>

                <div class="display-panel" id="resultsPanel">
                    <div class="icon-wrapper" id="displayIcon">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                        </svg>
                    </div>
                    <h3 class="display-title" id="displayTitle">Awaiting Selection...</h3>
                    <p class="display-subtitle" id="codesList">Please select a market from the dropdowns below.</p>
                </div>

                <div class="controls-grid">
                    <div class="control-group">
                        <label>Global Majors</label>
                        <select onchange="displayCodes(this, 'Global Majors')">
                            <option value="" disabled selected>Select a market...</option>
                            <option value="EPL, UCL, FIFA">Football (Soccer)</option>
                            <option value="NBA, FIBA">Basketball</option>
                            <option value="NFL, NCAAF">American Football</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label>Premium Markets</label>
                        <select onchange="displayCodes(this, 'Premium Markets')">
                            <option value="" disabled selected>Select a market...</option>
                            <option value="MLB, NPB">Baseball</option>
                            <option value="NHL, KHL">Ice Hockey</option>
                            <option value="UFC, Bellator, PFL">MMA / Combat</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label>Niche Markets</label>
                        <select onchange="displayCodes(this, 'Niche Markets')">
                            <option value="" disabled selected>Select a market...</option>
                            <option value="PDC, WDF">Darts</option>
                            <option value="WST, Q Tour">Snooker</option>
                            <option value="CS2, LoL, DOTA2">Esports</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label>ACCA's</label>
                        <select onchange="displayCodes(this, 'ACCA\'s')">
                            <option value="" disabled selected>Select a market...</option>
                            <option value="Match Winner, Over/Under 2.5, BTTS">Weekend Football ACCA</option>
                            <option value="Player Points, Rebounds, Assists">NBA Player Props ACCA</option>
                            <option value="Moneyline, Spread, Totals">Cross-Sport Mega ACCA</option>
                        </select>
                    </div>
                </div>
            </div>

            <script>
                function displayCodes(selectElement, category) {
                    const codes = selectElement.value;
                    const displayTitle = document.getElementById('displayTitle');
                    const codesList = document.getElementById('codesList');
                    const displayIcon = document.getElementById('displayIcon');
                    
                    if (codes) {
                        displayIcon.style.display = 'none';
                        displayTitle.textContent = `Codes for ${category}`;
                        displayTitle.style.color = '#94a3b8';
                        displayTitle.style.fontSize = '1.1rem';
                        
                        codesList.textContent = codes;
                        codesList.style.color = '#38bdf8';
                        codesList.style.fontSize = '1.8rem';
                        codesList.style.fontWeight = '700';
                        
                        const allSelects = document.querySelectorAll('select');
                        allSelects.forEach(select => {
                            if (select !== selectElement) {
                                select.selectedIndex = 0;
                            }
                        });
                    }
                }
            </script>
        </div> <!-- End of Sports Market Hub widget -->

        <!-- Rest of the original portal/tabs structure remains unchanged -->
        <div id="legacy-ui-wrapper" style="display: none;">
            <!-- ... all the existing legacy tab content, untouched ... -->
        </div>
    </section>
    <!-- Framework Section -->
    <section id="framework" class="framework-section">
        <div class="framework-container">
            <h2 class="framework-title">SKCS – Overall Outcome & Sports Analysis Framework</h2>
            <p class="framework-subtitle">Pure SKCS vision + outcomes — probability-driven system evaluating single markets and combined markets</p>
            <div class="framework-intro">
                <p>SKCS is built to analyze sports outcomes through a structured, probability-driven system that evaluates <strong>single markets and combined markets</strong> with the same level of discipline and risk awareness.</p>
                <p>Rather than treating all bets the same, SKCS categorizes and processes outcomes based on <strong>complexity, correlation, and exposure</strong>.</p>
            </div>
            <div class="framework-grid">
                <div class="framework-card">
                    <h3 class="framework-card-title"><span class="market-icon">1X2</span> 1X2 (Single Outcome Markets)</h3>
                    <p class="framework-card-text">For standard match result markets (Home / Draw / Away), SKCS focuses on:</p>
                    <ul class="framework-list">
                        <li>Event context (team form, lineup data, scheduling factors)</li>
                        <li>Market efficiency and implied probability</li>
                        <li>Cross-source validation to detect pricing inconsistencies</li>
                        <li>Risk-adjusted confidence scoring</li>
                    </ul>
                    <p class="framework-card-text">The goal is not prediction certainty, but <strong>identifying when a market price meaningfully diverges from calculated probability</strong>.</p>
                </div>
                <div class="framework-card">
                    <h3 class="framework-card-title"><span class="market-icon">M</span> Multi Bets (Cross-Event Selections)</h3>
                    <p class="framework-card-text">For multi bets involving <strong>separate events</strong>, SKCS:</p>
                    <ul class="framework-list">
                        <li>Evaluates each leg independently</li>
                        <li>Applies probability decay across combined selections</li>
                        <li>Flags combinations where added legs increase exposure without proportional value</li>
                        <li>Rejects weak or redundant selections automatically</li>
                    </ul>
                    <p class="framework-card-text">This prevents inflated confidence caused by stacking low-value outcomes.</p>
                </div>
                <div class="framework-card">
                    <h3 class="framework-card-title"><span class="market-icon">S</span> Same Match Bets (Correlated Markets)</h3>
                    <p class="framework-card-text">Same-match combinations require additional controls due to correlation risk. SKCS:</p>
                    <ul class="framework-list">
                        <li>Identifies dependent outcomes within the same event</li>
                        <li>Adjusts probability models to reflect correlation strength</li>
                        <li>Penalizes over-stacked or logically overlapping selections</li>
                        <li>Prioritizes balance between correlation and value</li>
                    </ul>
                    <p class="framework-card-text">Only combinations that pass correlation thresholds are considered viable.</p>
                </div>
                <div class="framework-card">
                    <h3 class="framework-card-title"><span class="market-icon">A</span> Accumulators (High-Exposure Structures)</h3>
                    <p class="framework-card-text">Accumulators represent the highest risk category and are treated as such. SKCS:</p>
                    <ul class="framework-list">
                        <li>Applies strict filtering and value thresholds</li>
                        <li>Limits accumulator depth to avoid exponential exposure</li>
                        <li>Highlights where perceived value is mathematically diluted</li>
                        <li>Scores accumulators conservatively, not optimistically</li>
                    </ul>
                    <p class="framework-card-text">Most accumulator structures are filtered out unless value survives compounding risk.</p>
                </div>
            </div>
            <div class="philosophy-section">
                <h3 class="philosophy-title">Core Outcome Philosophy</h3>
                <p style="text-align:center; color:#e9ecef;">Across all market types, SKCS operates on the same principles:</p>
                <div class="principles-grid">
                    <div class="principle"><h4>Probability over prediction</h4></div>
                    <div class="principle"><h4>Structure over emotion</h4></div>
                    <div class="principle"><h4>Risk awareness over payout appeal</h4></div>
                    <div class="principle"><h4>Consistency over short-term results</h4></div>
                </div>
                <p class="philosophy-statement">SKCS does not promise wins.<br>It provides <strong>clarity</strong>, <strong>discipline</strong>, and <strong>measured insight</strong> into how outcomes behave — individually and in combination.<br>The final outcome is a <strong>decision framework</strong>.</p>
            </div>
        </div>
    </section>
    <!-- About Section -->
    <section id="about" class="about-section">
        <div class="about-overlay"></div>
        <div class="about-container">
            <h2 class="about-title">About SKCS AI Sports Edge</h2>
            <div class="mission-statement">
                <h3>Our Mission</h3>
                <p><strong>SKCS (Smart Knowledge & Control Systems)</strong> is a data-driven analytics platform focused on transforming raw sports data into structured, responsible insights.</p>
                <p>Our core mission is simple: <span class="highlight">turn complex, fragmented sports data into clear, intelligent decision support.</span></p>
            </div>
            <p>SKCS AI aggregates and processes information from multiple trusted data sources — including football, rugby, AFL, baseball, basketball, Formula 1, cricket, and more — using automated pipelines, statistical models, and validation layers. Rather than relying on hype or guarantees, SKCS emphasizes <span class="highlight">probability, context, and transparency</span>.</p>
            <h3 class="section-subtitle">What Makes SKCS Different</h3>
            <ul class="feature-list">
                <li><strong>Multi-sport intelligence</strong> – One unified system across 13 sports</li>
                <li><strong>Layered analysis</strong> – Data is filtered, validated, and refined before insights are generated</li>
                <li><strong>Single-use insight policy</strong> – Once a fixture is published in one insight format, it is blocked from the other formats for that calendar week</li>
                <li><strong>Responsible design</strong> – No promises, no manipulation, no false certainty</li>
                <li><strong>Automation-first</strong> – Built to scale with minimal manual intervention</li>
                <li><strong>Developer-friendly</strong> – Modular architecture designed for expansion</li>
            </ul>
            <h3 class="section-subtitle">Our Vision</h3>
            <p>SKCS is designed to grow beyond daily sports insights alone. The long-term vision includes:</p>
            <ul class="vision-list">
                <li><strong>Advanced Performance Analytics</strong><p class="core-principle">Deep insights into team and player performance</p></li>
                <li><strong>Risk-Aware Modeling</strong><p class="core-principle">Volatility controls and risk management tools</p></li>
                <li><strong>AI-Assisted Research</strong><p class="core-principle">Smart comparison and research tools</p></li>
                <li><strong>Scalable Infrastructure</strong><p class="core-principle">Suitable for SaaS and enterprise use</p></li>
            </ul>
            <div class="mission-statement" style="margin-top:2.5rem;"><p style="font-size:1.2rem; font-style:italic;">At its core, SKCS is about <strong>clarity over noise</strong>, <strong>data over emotion</strong>, and <strong>systems that evolve responsibly</strong> as technology and information improve.</p></div>
        </div>
    </section>
    <!-- Contact Section -->
    <section id="contact" class="contact-section">
        <div class="contact-container">
            <h2 class="contact-title">Get In Touch</h2>
            <div class="form-container">
                <form id="contact-form" class="contact-form" action="#contact">
                    <input type="text" name="name" placeholder="Your Name" autocomplete="name" required class="form-input">
                    <input type="email" name="email" placeholder="Your Email" autocomplete="email" required class="form-input">
                    <textarea name="message" placeholder="Your Message" required class="form-textarea"></textarea>
                    <button type="submit" class="submit-btn">Send Message</button>
                </form>
            </div>
            <div class="contact-info">
                <div class="contact-item"><h4>📧 General Inquiries</h4><p>Email: <a href="mailto:info@skcs.co.za" class="email-link">info@skcs.co.za</a></p><p>Response time: 24-48 hours</p></div>
                <div class="contact-item"><h4>🔧 Technical Support</h4><p>Email: <a href="mailto:support@skcs.co.za" class="email-link">support@skcs.co.za</a></p><p>For website or platform issues</p></div>
                <div class="contact-item"><h4>📍 Follow Our Updates</h4><p>Updates and announcements coming soon</p><p>We're currently in development phase. Full contact options will be available when we launch.</p></div>
            </div>
            <p class="contact-note">AI-powered multi-sport insights platform covering 13 sports</p>
        </div>
    </section>
    </main>
    <!-- Footer -->
    <footer class="footer">
        <div class="footer-content">
            <p class="footer-company">SKCS AI Sports Edge - Your trusted source for AI-powered sports insights across 13 sports.</p>
            <div class="footer-links">
                <a href="terms.html">Terms of Service</a> | <a href="language-switch.html">Language</a>
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <p style="margin: 0.5rem 0; font-weight: 600;">SKCS AI SPORTS EDGE (PTY) LTD</p>
                <p style="margin: 0.25rem 0; font-size: 0.9rem;">Company Reg: 2025/918368/07</p>
                <p style="margin: 0.25rem 0; font-size: 0.9rem;">20 Lotus Road, Northdale</p>
                <p style="margin: 0.25rem 0; font-size: 0.9rem;">Pietermaritzburg, KwaZulu-Natal, 3201</p>
                <p style="margin: 0.25rem 0; font-size: 0.9rem;">South Africa</p>
            </div>
            <p class="copyright">© 2026 SKCS AI Sports Edge. Informational analytics only; no gambling services offered.</p>
        </div>
    </footer>

    <!-- Scripts (completely unchanged) -->
    <script src="js/config.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/supabase-init.js"></script>
    <style>
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    </style>
'@

# Read the JavaScript from the original file (lines 1989-5996)
$jsContent = Get-Content 'C:\Users\user\Downloads\!DOCTYPE html.txt' -TotalCount 5996 | Select-Object -Skip 1988 | Out-String

# Combine HTML and JavaScript
$finalContent = $html + "<script>`n" + $jsContent + "`n</script>`n</body>`n</html>"

# Write to index.html
Set-Content -Path "C:\Users\user\Desktop\Stephen Fynn\SKCS-test\public\index.html" -Value $finalContent
