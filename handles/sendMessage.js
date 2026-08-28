const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'https://graph.facebook.com/v23.0/me/messages';
const UPLOAD_URL = 'https://graph.facebook.com/v23.0/me/message_attachments';
const MAX_TEXT_LENGTH = 1900; // Safe below 2000 limit

const apiRequest = async (url, options, pageAccessToken) => {
  const response = await fetch(`${url}?access_token=${pageAccessToken}`, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.json();
};

// Set typing indicator
const setTyping = (senderId, action, pageAccessToken) => 
  apiRequest(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: senderId },
      sender_action: action
    })
  }, pageAccessToken);

// Upload file attachment
const uploadAttachment = async (filePath, type, pageAccessToken) => {
  const formData = new FormData();
  formData.append('message', JSON.stringify({
    attachment: { type, payload: { is_reusable: true } }
  }));
  formData.append('filedata', fs.createReadStream(filePath));
  
  const response = await fetch(`${UPLOAD_URL}?access_token=${pageAccessToken}`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  
  const result = await response.json();
  return result.attachment_id;
};

// Split text into chunks
const splitText = (text) => {
  const chunks = [];
  
  // Kung maikli lang, return as is
  if (text.length <= MAX_TEXT_LENGTH) {
    return [text];
  }
  
  // Hatiin sa paragraphs muna
  const paragraphs = text.split('\n');
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Kung ang paragraph mismo ay mahigit sa MAX_TEXT_LENGTH
    if (paragraph.length > MAX_TEXT_LENGTH) {
      // I-save ang current chunk
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // Hatiin ang mahabang paragraph
      for (let i = 0; i < paragraph.length; i += MAX_TEXT_LENGTH) {
        chunks.push(paragraph.slice(i, i + MAX_TEXT_LENGTH));
      }
    }
    // Kung kasya pa sa current chunk
    else if ((currentChunk + '\n' + paragraph).length <= MAX_TEXT_LENGTH) {
      currentChunk += (currentChunk ? '\n' : '') + paragraph;
    }
    // Kung hindi na kasya, i-save ang current at magsimula ng bago
    else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    }
  }
  
  // I-save ang huling chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

const sendMessage = async (senderId, message, pageAccessToken) => {
  const { text = '', attachment = null, quick_replies = [], buttons = [] } = message;
  
  if (!text && !attachment) return;
  
  try {
    await setTyping(senderId, 'typing_on', pageAccessToken);
    
    // Kung may attachment, ipadala ng direkta (hindi kailangan i-split)
    if (attachment) {
      // Direct file upload
      if (attachment.filePath) {
        const formData = new FormData();
        formData.append('recipient', JSON.stringify({ id: senderId }));
        formData.append('message', JSON.stringify({
          attachment: { type: attachment.type, payload: {} }
        }));
        formData.append('filedata', fs.createReadStream(attachment.filePath));
        
        const response = await fetch(`${API_URL}?access_token=${pageAccessToken}`, {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders()
        });
        
        if (!response.ok) {
          throw new Error(`File upload failed: ${response.status}`);
        }
        
        await setTyping(senderId, 'typing_off', pageAccessToken);
        return;
      }
      
      // Template or URL attachment
      let messagePayload = { recipient: { id: senderId }, message: {} };
      
      if (attachment.type === 'template') {
        messagePayload.message.attachment = {
          type: 'template',
          payload: attachment.payload
        };
      } else {
        messagePayload.message.attachment = {
          type: attachment.type,
          payload: attachment.payload || {}
        };
      }
      
      if (text) {
        messagePayload.message.text = text;
      }
      
      await apiRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload)
      }, pageAccessToken);
      
      await setTyping(senderId, 'typing_off', pageAccessToken);
      return;
    }
    
    // Button template
    if (buttons.length) {
      const messagePayload = {
        recipient: { id: senderId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: text || 'Choose an option:',
              buttons: buttons.map(btn => ({
                type: 'postback',
                title: btn.title,
                payload: btn.payload
              }))
            }
          }
        }
      };
      
      await apiRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload)
      }, pageAccessToken);
      
      await setTyping(senderId, 'typing_off', pageAccessToken);
      return;
    }
    
    // Text message - I-split kung mahaba
    if (text) {
      const chunks = splitText(text);
      
      for (const chunk of chunks) {
        const messagePayload = {
          recipient: { id: senderId },
          message: { text: chunk }
        };
        
        // Quick replies ay ilalagay lang sa huling chunk
        if (quick_replies.length && chunk === chunks[chunks.length - 1]) {
          messagePayload.message.quick_replies = quick_replies.map(qr => ({
            content_type: 'text',
            title: qr.title,
            payload: qr.payload
          }));
        }
        
        await apiRequest(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload)
        }, pageAccessToken);
      }
    }
    
    await setTyping(senderId, 'typing_off', pageAccessToken);
    
  } catch (error) {
    console.error('Send message error:', error.message);
    throw error;
  }
};

module.exports = { sendMessage };
