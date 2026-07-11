import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function ProposalAction() {
  const { hash, action } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const processAction = async () => {
      try {
        const response = await fetch(`/api/proposal/${hash}/${action}`, {
          method: 'POST'
        });
        
        if (response.ok || response.redirected) {
          navigate(`/proposal/${hash}?status=${action}d`, { replace: true });
        } else {
          navigate(`/proposal/${hash}?status=error`, { replace: true });
        }
      } catch (err) {
        navigate(`/proposal/${hash}?status=error`, { replace: true });
      }
    };

    if (hash && action) {
      processAction();
    }
  }, [hash, action, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Processing your request...</h2>
        <p className="text-gray-600">Please wait while we update the proposal.</p>
      </div>
    </div>
  );
}