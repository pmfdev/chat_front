import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Menu, X, Send, Users, MessageSquare, LogOut } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
}

interface PrivateChat {
  user: string;
  messages: Message[];
}

const Chat: React.FC = () => {
  const { token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [notificationSound] = useState(new Audio('/notification.mp3'));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      const newClient = new Client({
        webSocketFactory: () => new SockJS(import.meta.env.VITE_WEBSOCKET_URL),
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        onConnect: () => {
          console.log('Connected to WebSocket');
          newClient.subscribe('/topic/public', (message) => {
            const receivedMessage = JSON.parse(message.body);
            setMessages((prevMessages) => [...prevMessages, receivedMessage]);
          });
          newClient.subscribe('/topic/users', (message) => {
            setConnectedUsers(JSON.parse(message.body));
          });
          newClient.subscribe('/user/queue/private', (message) => {
            const receivedMessage = JSON.parse(message.body);
            handlePrivateMessage(receivedMessage);
          });
        },
        onDisconnect: () => {
          console.log('Disconnected from WebSocket');
        },
      });
      newClient.activate();
      setClient(newClient);
    }

    return () => {
      if (client) {
        client.deactivate();
      }
    };
  }, [isAuthenticated, token, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handlePrivateMessage = (message: Message) => {
    setPrivateChats((prevChats) => {
      const existingChatIndex = prevChats.findIndex((chat) => chat.user === message.sender);
      if (existingChatIndex !== -1) {
        const updatedChats = [...prevChats];
        updatedChats[existingChatIndex].messages.push(message);
        return updatedChats;
      } else {
        return [...prevChats, { user: message.sender, messages: [message] }];
      }
    });
    notificationSound.play();
  };

  const sendMessage = (isPrivate: boolean = false, recipient?: string) => {
    if (inputMessage.trim() && client) {
      const destination = isPrivate ? `/app/private/${recipient}` : '/app/message';
      client.publish({
        destination: destination,
        body: JSON.stringify({ content: inputMessage }),
      });
      setInputMessage('');
    }
  };

  const startPrivateChat = (user: string) => {
    if (!privateChats.find((chat) => chat.user === user)) {
      setPrivateChats([...privateChats, { user, messages: [] }]);
    }
  };

  const closePrivateChat = (user: string) => {
    setPrivateChats(privateChats.filter((chat) => chat.user !== user));
  };

  const handleLogout = () => {
    if (client) {
      client.deactivate();
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar for connected users */}
      <div className={`bg-white w-64 p-6 ${showUserPanel ? 'block' : 'hidden'} md:block`}>
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Users className="mr-2" /> Connected Users
        </h2>
        <ul>
          {connectedUsers.map((user) => (
            <li
              key={user}
              className="mb-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
              onClick={() => startPrivateChat(user)}
            >
              {user}
            </li>
          ))}
        </ul>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white shadow p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Real-Time Chat</h1>
          <div className="flex items-center">
            <button
              onClick={() => setShowUserPanel(!showUserPanel)}
              className="md:hidden p-2 rounded-full hover:bg-gray-200 mr-2"
            >
              {showUserPanel ? <X /> : <Menu />}
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 flex items-center"
            >
              <LogOut className="mr-2" size={18} />
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg, index) => (
            <div key={index} className="mb-4">
              <span className="font-bold">{msg.sender}: </span>
              <span>{msg.content}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-gray-200 p-4">
          <div className="flex">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 rounded-l-lg p-2 outline-none"
              placeholder="Type a message..."
            />
            <button
              onClick={() => sendMessage()}
              className="bg-blue-500 text-white px-4 rounded-r-lg hover:bg-blue-600"
            >
              <Send />
            </button>
          </div>
        </div>
      </div>

      {/* Private chat popups */}
      <div className="fixed bottom-0 right-0 m-4 flex flex-col-reverse items-end space-y-reverse space-y-2">
        {privateChats.map((chat) => (
          <div key={chat.user} className="bg-white rounded-lg shadow-lg w-80">
            <div className="bg-blue-500 text-white p-2 rounded-t-lg flex justify-between items-center">
              <span>{chat.user}</span>
              <button onClick={() => closePrivateChat(chat.user)} className="text-white hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="h-48 overflow-y-auto p-2">
              {chat.messages.map((msg, index) => (
                <div key={index} className="mb-2">
                  <span className="font-bold">{msg.sender}: </span>
                  <span>{msg.content}</span>
                </div>
              ))}
            </div>
            <div className="p-2 flex">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 rounded-l-lg p-1 outline-none border"
                placeholder="Type a message..."
              />
              <button
                onClick={() => sendMessage(true, chat.user)}
                className="bg-blue-500 text-white px-2 rounded-r-lg hover:bg-blue-600"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Chat;