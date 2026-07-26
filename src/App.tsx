import { AuthProvider } from "./shared/context/AuthContext";
import MainLayout from "./shared/components/layout/MainLayout";

function App() {

    return (
        <AuthProvider>
            <MainLayout />
        </AuthProvider>
    );

}

export default App;