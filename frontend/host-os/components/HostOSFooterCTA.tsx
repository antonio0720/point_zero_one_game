/**
 * Footer Component for Host OS v2 announcement and email waitlist capture
 */

type Props = {
  onWaitlistSubmit: (email: string) => void;
};

const HostOSFooterCTA: React.FC<Props> = ({ onWaitlistSubmit }) => {
  const handleWaitlistSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = (event.currentTarget.elements.email as HTMLInputElement).value;
    onWaitlistSubmit(email);
  };

  return (
    <footer className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h2 className="text-xl font-bold">Host OS v2 coming</h2>
        <div>
          <p className="text-sm">Onboarding funnel + streak rewards + automated clip packaging</p>
          <form onSubmit={handleWaitlistSubmit}>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              type="email"
              name="email"
              id="email"
              required
              className="appearance-none bg-gray-300 border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500"
            />
            <button
              type="submit"
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Join Waitlist
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
};

export default HostOSFooterCTA;
