import '../index.css';
import { AuthProvider } from "@/auth/AuthContext";

export const metadata = {
    title: 'HFF Dashboard',
    description: 'Healthy Families Foundation Analytics Portal',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="font-sans antialiased">
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
