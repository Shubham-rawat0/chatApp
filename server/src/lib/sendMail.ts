export const sendMail = (to: string, name: string) => {
  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(process.env.SG_API_KEY);

  const msg = {
    to,
    from: "drippinsaul@gmail.com",
    subject: `Welcome to ChatApp, ${name}! 🎉`,
    text: `Hi ${name},

Thank you for joining ChatApp! We're excited to have you on board.

With ChatApp, you can:
- Chat one-on-one with your friends or colleagues.
- Create and join group chats to stay connected with multiple people at once.
- Share ideas, messages, and collaborate seamlessly.

We hope you enjoy using ChatApp and connecting with others.

Happy chatting! 🚀

— The ChatApp Team`,
    mailSettings: {
      sandboxMode: { enable: false}, 
    },
  };

  sgMail
    .send(msg)
    .then(() => console.log(`Email sent to ${to}`))
    .catch((err: any) => console.error("Error sending email:", err));
};
