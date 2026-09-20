import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed:false }; }
  static getDerivedStateFromError() { return { failed:true }; }
  render() {
    if (this.state.failed) return <main className="boot-screen"><h1>{'Something went wrong'}</h1><p>{'Refresh the app. Saved files will remain in Storage.'}</p><button className="button primary" onClick={() => location.reload()}>{'Refresh'}</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
