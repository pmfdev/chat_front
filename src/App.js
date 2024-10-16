import React, { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import './App.css';  // Asegúrate de crear este archivo para el estilo

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [client, setClient] = useState(null);
  const [messageContent, setMessageContent] = useState(""); // Estado para el mensaje
  const [username, setUsername] = useState(""); // Estado para el nombre de usuario

  // Función para conectarse a WebSocket
  const connectToWebSocket = () => {
    const stompClient = new Client({
      webSocketFactory: () => new SockJS('https://pmfdev.es/chatApi/chat-websocket'),
      onConnect: () => {
        console.log("Conectado al WebSocket");

        // Suscribirse al canal de chat general
        stompClient.subscribe("/topic/public", (message) => {
          const newMessage = JSON.parse(message.body);
          setMessages((prevMessages) => [...prevMessages, newMessage]);
        });
      },
      onStompError: (frame) => {
        console.error('Error en STOMP: ', frame);
      },
    });

    stompClient.activate();
    setClient(stompClient);
  };

  // Enviar un mensaje a la sala general
  const sendMessage = () => {
    if (client && client.connected && messageContent.trim() !== "" && username.trim() !== "") {
      const chatMessage = {
        contenido: messageContent, 
        username: username // Enviamos el nombre ingresado
      };

      client.publish({
        destination: "/app/chat.general",
        body: JSON.stringify(chatMessage),
      });

      setMessageContent(""); // Limpiar el campo de mensaje después de enviar
    } else {
      console.error("No hay conexión WebSocket activa o el mensaje/usuario está vacío");
    }
  };

  // Conectar a WebSocket automáticamente cuando se monte el componente
  useEffect(() => {
    connectToWebSocket();
  }, []); // Este useEffect se ejecuta solo una vez

  return (
    <div className="chat-container">
      <h1>Chat General</h1>

      <div className="chat-messages">
        <ul>
          {messages.map((message, index) => (
            <li key={index}><strong>{message.usuario.username}:</strong> {message.contenido}</li>
          ))}
        </ul>
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Tu nombre de usuario"
          className="username-input"
        />
        <input
          type="text"
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          placeholder="Escribe tu mensaje aquí..."
          className="message-input"
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} className="send-button">Enviar Mensaje</button>
      </div>
    </div>
  );
};

export default ChatApp;
