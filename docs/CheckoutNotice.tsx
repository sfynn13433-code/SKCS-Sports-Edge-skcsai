import React from 'react';

type CheckoutNoticeProps = {
  currentHourSAST: number;
  processPayment: () => void;
};

const CheckoutNotice = ({ currentHourSAST, processPayment }: CheckoutNoticeProps) => {
  const isLateJoiner = currentHourSAST >= 11;

  const handleCheckoutClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    const userAgreed = window.confirm(
      'By proceeding, you confirm that you have read and accept our Terms of Service and Privacy Policy. You understand you are buying into this specific tier and acknowledge our STRICT NO REFUNDS policy. Do you wish to continue?'
    );

    if (userAgreed) {
      processPayment();
    }
  };

  return (
    <div className="checkout-container">
      {isLateJoiner && (
        <div
          className="alert-banner bonus-pass"
          style={{ border: '1px solid #4CAF50', padding: '15px', marginBottom: '20px' }}
        >
          <h3>⏰ You&apos;re unlocking a Day Zero Bonus Pass!</h3>
          <p>
            Because you joined after today&apos;s premium cutoff, your official tier will begin exactly at{' '}
            <strong>00:00 SAST</strong> so you receive full, fair-value access from Day 1.
          </p>
          <ul>
            <li>
              <strong>Available right now:</strong> Enjoy complimentary access to selected Day Zero 1x2
              tips and Secondary Insights for eligible fixtures tonight.
            </li>
            <li>
              <strong>Starting tomorrow at 06:00 SAST:</strong> Your full premium ACCA cycle unlocks.
            </li>
          </ul>
        </div>
      )}

      <div
        className="alert-banner strict-warning"
        style={{ border: '1px solid #f44336', padding: '15px', marginBottom: '20px' }}
      >
        <h4>⚠️ IMPORTANT: NO REFUNDS POLICY</h4>
        <p>
          Due to the time-sensitive and highly consumable nature of sports prediction data,{' '}
          <strong>ALL SALES ARE FINAL.</strong> By completing this purchase, you acknowledge that you are
          buying access to premium digital insights for your selected tier.{' '}
          <strong>There will be NO REFUNDS granted under any circumstances</strong>.
        </p>
      </div>

      <div className="checkout-actions">
        <button className="btn-primary" onClick={handleCheckoutClick}>
          Select Plan &amp; Pay
        </button>
      </div>
    </div>
  );
};

export default CheckoutNotice;
