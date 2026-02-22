/**
 * ActionSubmittedToasts.tsx
 *
 * Displays a toast for an action submission and clears it after a timer.
 */

import React, { useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type ActionSubmittedToastProps = {
  /** The message to display in the toast */
  message: string;
};

/**
 * Displays a toast for an action submission and clears it after a timer.
 *
 * @param props - The properties of the component.
 */
const ActionSubmittedToast: React.FC<ActionSubmittedToastProps> = ({ message }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hideToast = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    // Clear timeout if component unmounts
    return () => clearTimeout(hideToast);
  }, []);

  return (
    <>
      {isVisible && (
        <ToastContainer position="top-center" autoClose={5000} hideProgressBar={false}>
          <toast>{message}</toast>
        </ToastContainer>
      )}
    </>
  );
};

export { ActionSubmittedToast };
