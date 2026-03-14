import React from 'react';
import './Guide.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faComments, faBook, faMagic, faPenNib, faGhost, faStar, faRocket, faKeyboard } from '@fortawesome/free-solid-svg-icons';

const Guide = () => {
    return (
        <div className="guide-container">
            <div className="sketch-bg-decorative"></div>
            
            <header className="guide-header">
                <div className="title-wrapper">
                    <h1 className="sketch-title">Bí kíp Notaion <FontAwesomeIcon icon={faPenNib} className="spin-icon" /></h1>
                    <div className="sketch-underline"></div>
                </div>
                <p className="sketch-subtitle">Chào mừng bạn đến với góc nhỏ của những kẻ lười ghi chép nhưng vẫn muốn xinh!</p>
            </header>

            <div className="guide-grid">
                <div className="guide-card card-yellow sticky-note">
                    <div className="card-badge">CƠ BẢN</div>
                    <div className="card-icon"><FontAwesomeIcon icon={faBook} /></div>
                    <h3>Viết là có, Gõ là lưu</h3>
                    <p>App này sinh ra cho người lười. Cứ gõ nội dung vào trang chủ, hệ thống sẽ tự động lưu lại tức thì. Đừng đi tìm nút Save nhé, không có đâu!</p>
                    <div className="doodle doodle-1">✨</div>
                </div>

                <div className="guide-card card-blue paper-scrap">
                    <div className="card-icon"><FontAwesomeIcon icon={faComments} /></div>
                    <h3>Góc "Tám Chuyện"</h3>
                    <p>Cái khung chat ở góc phải bên dưới là nơi bạn có thể để lại lời nhắn hoặc tán gẫu. Mọi người (và cả Bot) luôn ở đó.</p>
                    <div className="doodle doodle-2">💬</div>
                </div>

                <div className="guide-card card-green notebook-page">
                    <div className="card-icon"><FontAwesomeIcon icon={faMagic} /></div>
                    <h3>Pháp sư AI /bot</h3>
                    <p>Trong khung chat, hãy gõ <code>/bot [câu hỏi của bạn]</code> để triệu hồi chú Robot thông thái. Giải bài tập, hỏi code, hay nhờ nó làm thơ đều "okela" hết.</p>
                    <div className="doodle doodle-3">🤖</div>
                </div>

                <div className="guide-card card-pink doodle-box">
                    <div className="card-icon"><FontAwesomeIcon icon={faLightbulb} /></div>
                    <h3>Skill "Thượng thừa"</h3>
                    <ul className="guide-list">
                        <li><FontAwesomeIcon icon={faStar} /> <b>Dán link thông minh:</b> Link Youtube, Spotify, Hình ảnh... chỉ cần dán vào là nó hiện ra xịn xò như một trang báo.</li>
                        <li><FontAwesomeIcon icon={faStar} /> <b>Xem Phím tắt:</b> Đừng quên ghé qua trang **Shortcut** để xem danh sách phím tắt "thần thánh" giúp bạn gõ nhanh như chớp nhé! <button className="text-blue-600 underline font-bold" onClick={() => navigate('/shortcut')}>Đi thôi!</button></li>
                        <li><FontAwesomeIcon icon={faStar} /> <b>Markdown:</b> Hỗ trợ # Heading, **Bôi đậm**, <i>Nghiêng</i> cực chuẩn cho dân chuyên nghiệp.</li>
                        <li><FontAwesomeIcon icon={faStar} /> <b>Kéo thả:</b> Click và kéo icons để sắp xếp lại trật tự thế giới (hoặc chỉ là mấy cái note của bạn).</li>
                    </ul>
                </div>
            </div>

            <section className="guide-quote">
                <div className="quote-box">
                    <FontAwesomeIcon icon={faGhost} className="ghost-icon" />
                    <p className="handwritten">"Code có thể nhiều bug, nhưng ghi chú nhất định phải lung linh!"</p>
                    <p className="author">- Ẩn danh đẹp trai -</p>
                </div>
            </section>

            <footer className="guide-footer">
                <div className="footer-content">
                    <p>© 2026 Notaion Team <FontAwesomeIcon icon={faRocket} /></p>
                    <small>Dành cho các bạn Dev thế hệ mới cực cool.</small>
                </div>
            </footer>
        </div>
    );
};

export default Guide;
