import { useSessionTimeout } from "../hooks/useSessionTimeout";

const SessionProvider = ({ children }) => {
  useSessionTimeout(); // Initialize session timeout for admin
  return children;
};

export default SessionProvider;
