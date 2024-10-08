import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Modal } from 'antd';

const Guide = ({ visible, onClose }) => {
    const [content, setContent] = useState('');

    return (
        <div style={{ padding: '20px' }}>
            <ReactMarkdown>
                {`# NOTAION

Fast note for dev

## Demo

[Demo Link](https://notaion.onrender.com/)

## 🛠 Component

\`\`\`ASP.NET 7 API\`\`\` 

\`\`\`ReactJS\`\`\`

\`\`\`Vite\`\`\`


## Screenshots

![main page](https://res.cloudinary.com/dl3hvap4a/image/upload/v1726144725/Screenshot_2024-09-12_193245_cl1he1.png)

![profile](https://res.cloudinary.com/dl3hvap4a/image/upload/v1726144726/Screenshot_2024-09-12_193302_lhgtgw.png)

![list pages](https://res.cloudinary.com/dl3hvap4a/image/upload/v1726144725/Screenshot_2024-09-12_193200_tzkmjc.png)

![content](https://res.cloudinary.com/dl3hvap4a/image/upload/v1726144725/Screenshot_2024-09-12_193353_xi4825.png)

## Running

To run tests, run the following command:

\`\`\`bash
npm run dev
\`\`\`

## Installation

Install \`notaion\` with npm:

\`\`\`bash
npm install
\`\`\`
                    `}
            </ReactMarkdown>
        </div>
    );
};

export default Guide;
