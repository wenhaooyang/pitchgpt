// src/ChatUI.tsx

import { useState } from 'react';

const ChatUI = () => {
  const [messages, setMessages] = useState([
    { text: 'Hello! How can I assist you?', sender: 'bot' },
  ]);
  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Add user's message to the chat
    setMessages([...messages, { text: input, sender: 'user' }]);

    // Call the backend API with the user's message
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    // Add the bot's reply to the chat
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: data.reply, sender: 'bot' },
    ]);

    // Clear input field
    setInput('');
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-4 rounded-lg shadow-lg">
      <div className="space-y-4 h-80 overflow-y-scroll mb-4 p-2 border border-gray-200">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-2 rounded-lg ${msg.sender === 'bot' ? 'bg-gray-200' : 'bg-blue-100'}`}
          >
            <span className={`${msg.sender === 'bot' ? 'text-gray-600' : 'text-blue-600'}`}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-l-lg"
          placeholder="Type your message..."
        />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded-r-lg">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatUI;
