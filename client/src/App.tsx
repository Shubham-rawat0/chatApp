import { BrowserRouter,Routes,Route } from "react-router-dom"
import Setting from "./pages/tabs/SettingTab"
import Welcome from "./pages/Welcome"
import Homepage from "./pages/Homepage"
const App = () => {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<Welcome/>}/>
      <Route path="/chat" element={<Homepage/>}/>
      <Route path="/setting" element={<Setting/>}/>
    </Routes>
    </BrowserRouter>
  )
}
export default App