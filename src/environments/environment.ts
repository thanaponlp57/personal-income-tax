export const environment = {
  // same-origin: เรียก API ผ่าน path relative แล้วให้ nginx (:4200) reverse-proxy ต่อไป BE
  // → SESSION cookie เป็น first-party ของ taxfe.local (ใช้ได้ทุก browser). ดู task-09/task-10
  apiBaseUrl: '',
  production: true,
};
