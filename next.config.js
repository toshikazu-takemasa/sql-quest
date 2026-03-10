/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    // Cloudflare Pages にデプロイする場合は 'export' を検討しますが、
    // API Routes (大賢者の助言など) を使う場合は Workers 連携が必要です。
    // 現在はローカル開発・Cloudflare Pages+Workers 構成を念頭に標準設定にします。
};

module.exports = nextConfig;
