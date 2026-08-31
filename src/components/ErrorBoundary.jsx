import { Component } from 'react';
import { STRINGS } from '../i18n';
import { CSS } from '../styles';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const lang = localStorage.getItem('behave_uilang') || 'en';
    const copy = STRINGS[lang] || STRINGS.en;
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="error-boundary"><div className="auth-orb"/><h1>{copy.errorTitle}</h1><p>{copy.errorBody}</p><button className="btn btn-primary" onClick={() => window.location.reload()}>{copy.reload}</button></div>
        </div>
      </>
    );
  }
}
