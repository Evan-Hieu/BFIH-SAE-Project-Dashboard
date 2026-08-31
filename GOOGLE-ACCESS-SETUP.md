# Đăng nhập và quyền sửa TNO / Inhouse

Đăng nhập web dùng User/Password và quyền web được lưu ở máy chủ (xem USER-AUTH-SETUP.md). Google kiểm soát quyền riêng trên từng file; cần đồng thời cả hai quyền để lưu. Bản User cũ trong trình duyệt chỉ là bản nháp. Admin/admin không cấp quyền đọc hay sửa nguồn. Web không lưu mật khẩu, client secret hoặc access token xuống bộ nhớ lưu trữ; token chỉ ở bộ nhớ của tab.

## Google Cloud cần cấu hình một lần

1. Chọn project `bfih-sae-dashboard` và bật Google Drive API (Sheets API đã được dùng trước đây).
   https://console.cloud.google.com/apis/library/drive.googleapis.com?project=bfih-sae-dashboard
2. Trong Google Auth Platform > Data Access, cấu hình các scope ứng dụng dùng:
   - `https://www.googleapis.com/auth/userinfo.email`: xác nhận email Google đang kết nối.
   - `https://www.googleapis.com/auth/drive.metadata.readonly`: kiểm tra capabilities của hai file. Đây là scope đọc metadata có phạm vi rộng hơn hai file; code chỉ gọi hai ID đã cấu hình, không liệt kê Drive. Google có thể yêu cầu xác minh ứng dụng khi xuất bản vì scope này thuộc nhóm restricted.
   - `https://www.googleapis.com/auth/spreadsheets.readonly`: đọc dữ liệu.
   - `https://www.googleapis.com/auth/spreadsheets`: chỉ yêu cầu khi người dùng xác nhận lưu thay đổi.
3. Nếu OAuth đang Testing, thêm email cộng tác viên vào Test users. Họ phải có tài khoản Google dùng chính email được chia sẻ; chính sách Google Workspace có thể yêu cầu quản trị viên công ty cho phép ứng dụng.
4. Không đưa client secret vào GitHub Pages.

## Chia sẻ quyền cho từng email

Mở đúng file > Share. Chọn Viewer hoặc Editor riêng từng file:

- TNO: https://docs.google.com/spreadsheets/d/1KHBzyi9vcIiqwzKOGVtJNZXC6rqULJYyyhvO69XoDuE/edit
- Inhouse: https://docs.google.com/spreadsheets/d/1VXRGCvQp37ppTEpMCmt_sSklmzbH3f2vSH7jkASehDU/edit

Ví dụ một người có thể là Editor ở TNO và Viewer ở Inhouse. Commenter không được sửa ô; tính năng gửi comment chưa có trên dashboard. Quyền chia sẻ ở cấp file, không chỉ một tab. Không dùng chế độ Anyone with the link để cấp quyền sửa.

## Cộng tác viên sử dụng

1. Đăng nhập web bằng User/Password do Admin tạo; sau đó bấm Google Sheet để kết nối đúng email Admin đã khai báo.
2. Mục User > Google Sheet access hiện email và quyền riêng từng nguồn.
3. Ô thường chỉ sửa được khi đã xác minh Editor; ô công thức luôn chỉ đọc. Google vẫn kiểm tra các vùng được bảo vệ khi lưu.
4. Review changes > Confirm save. Web kiểm tra lại quyền và dữ liệu nguồn trước khi ghi đúng các ô đã sửa.
5. Switch account yêu cầu xử lý thay đổi chưa lưu và xóa dữ liệu đang hiển thị trước khi nối tài khoản mới. Logout xóa phiên trong bộ nhớ.

Nếu kiểm tra Drive thất bại, web vẫn có thể đọc dữ liệu qua Sheets API nhưng khóa sửa cho đến khi xác minh được quyền. Chưa có quyền chung theo tab website hoặc dịch vụ quản lý User tập trung. Chọn Edit trong bản nháp User không thay thế quyền trên Google Sheet.

## Tài liệu gốc

- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get
- https://developers.google.com/workspace/drive/api/guides/manage-sharing
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
