# User/Password đăng nhập web, Google chỉ dùng để kết nối Sheet

## Trạng thái

Đã có code máy chủ và kiểm thử. GitHub Pages không chạy Node.js hoặc SQLite: tài khoản dùng chung CHƯA hoạt động trên địa chỉ github.io cho đến khi triển khai máy chủ. Trên Pages, Admin/admin chỉ mở bản xem thử; không cấp quyền sửa. Không có mật khẩu thật hoặc database nào được đưa vào Git.

Không dùng bảng User trong localStorage để xác thực. Dữ liệu draft hiện tại không tự được upload. Sau khi triển khai, quản trị viên tạo lại từng tài khoản thật (ví dụ Hubert), nhập username, mật khẩu và email Google tương ứng.

## Luồng đúng

1. Admin tạo user trong User: Login ID, password, email, quyền từng tab.
2. Người dùng đăng nhập web bằng Login ID/password. Sidebar hiển thị tên user web.
3. Người dùng bấm Google Sheet sau khi đăng nhập, kết nối đúng email được khai báo. Google không đăng nhập thay user web.
4. Máy chủ kiểm tra quyền web và email Google. Đọc cần View/Comment/Edit; ghi cần Edit ở đúng TNO hoặc Inhouse. Ngoài ra Google phải cho phép sửa file và ô tương ứng.
5. Review changes > Confirm save vẫn phải bấm rõ ràng. Dữ liệu User trên máy chủ chỉ Admin được thay đổi.

## Chạy máy chủ

Cần Node.js 24, ổ lưu bền vững, HTTPS cho truy cập từ Internet. Máy chủ phục vụ cả dashboard và API cùng một domain để cookie phiên không phụ thuộc cookie bên thứ ba.

Đặt biến môi trường riêng trên máy chủ (không commit vào Git):
- APP_ORIGIN: URL website thực tế, ví dụ https://sae.company.example (không có dấu / cuối).
- HOST: 0.0.0.0 nếu nằm sau reverse proxy đáng tin cậy; mặc định chỉ 127.0.0.1.
- PORT: mặc định 8787.
- DB_PATH: đường dẫn database riêng, mặc định server/data/users.sqlite. Cần backup và quyền truy cập filesystem giới hạn.
- ADMIN_EMAIL: email Google của quản trị viên, chỉ dùng tạo admin lần đầu.
- ADMIN_PASSWORD: mật khẩu admin đầu tiên, tối thiểu 12 ký tự. Nhập qua cấu hình secrets của dịch vụ, không gửi qua chat. Có thể bỏ biến này sau khi tạo database.
- GOOGLE_CLIENT_ID: OAuth client ID (mặc định client hiện có).

Chạy: `node server/start.mjs`

Google Cloud: bổ sung origin HTTPS mới vào Authorized JavaScript origins của OAuth client, bật Sheets API và Drive API, cấu hình consent scopes/Test users theo GOOGLE-ACCESS-SETUP.md. Chính sách công ty có thể yêu cầu IT phê duyệt. Không chạy máy chủ public qua HTTP hoặc sửa cookie để bỏ Secure.

## Bảo vệ đã cài

- Password được băm scrypt với salt riêng; API không trả hash/password.
- Cookie phiên HttpOnly + SameSite=Strict; Secure khi HTTPS; phiên 8 giờ, phiên ID lưu dưới dạng hash.
- Kiểm tra Origin và header tùy chỉnh cho API ghi; giới hạn đăng nhập; không ghi log mật khẩu/token.
- User API chỉ Admin, kiểm tra lại user/quyền từ SQLite trên mỗi API.
- Token Google chỉ giữ trong RAM gắn với phiên web; kiểm tra audience OAuth và email đã xác minh.
- Proxy chỉ cho phép hai spreadsheet ID đã cấu hình; không nhận URL Google tùy ý. Chỉ ghi tối đa 200 ô dữ liệu mỗi lần, RAW, không ghi dòng tiêu đề hoặc ô công thức.
- Thu hồi quyền web có hiệu lực ở API ngay; thay mật khẩu/email hoặc tắt user sẽ vô hiệu hóa phiên.
- Không tự cấp quyền chia sẻ Google. Không dùng mật khẩu website làm mật khẩu Google.

## Giới hạn triển khai cần lưu ý

- Chưa triển khai máy chủ và chưa thử tài khoản/Google token thật. Kiểm thử dùng dữ liệu giả, không ghi hai Sheet thật.
- HTTPS, backup/restore, vận hành, giám sát và chống brute-force ở reverse proxy phải được cấu hình trước khi mở rộng sử dụng. Database SQLite phù hợp một tiến trình; token RAM mất khi restart và người dùng cần kết nối lại Google.
- Trang Calendar/ghi chú và các tab chưa có API vẫn giữ cơ chế cũ; quyền dữ liệu nguồn TNO/Inhouse mới được kiểm soát phía máy chủ. Chưa có tính năng gửi comment.
- Google vẫn có thể cho user sửa trực tiếp trong Google Sheets bên ngoài web; quyền web không thu hồi quyền Google.

Kiểm thử: `node server/app.test.mjs` và `node google-access.test.cjs`.
