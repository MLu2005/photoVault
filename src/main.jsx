import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed:false }; }
  static getDerivedStateFromError() { return { failed:true }; }
  render() {
    if (this.state.failed) return <main className="boot-screen"><h1>{'Coś poszło nie tak'}</h1><p>{'Odśwież aplikację. Zapisane pliki pozostają w Storage.'}</p><button className="button primary" onClick={() => location.reload()}>{'Odśwież'}</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
