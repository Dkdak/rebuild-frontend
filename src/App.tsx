import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./components/layout/MainLayout";

function App() {

    return (
        <AuthProvider>
            <MainLayout />
        </AuthProvider>
    );

}

export default App;