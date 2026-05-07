export const metadata = {
  title: "ENS Subname Toolkit Dashboard",
  description: "Admin dashboard for subname issuance and analytics"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, Arial, sans-serif", background: "#0b1020", color: "#eef2ff" }}>
        {children}
      </body>
    </html>
  );
}
