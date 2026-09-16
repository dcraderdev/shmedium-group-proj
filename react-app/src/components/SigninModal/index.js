import React, { useEffect, useRef, useState, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import './SigninModal.css';
import { ModalContext } from '../../context/ModalContext';
import * as sessionActions from '../../store/session';
import useDialog from '../../hooks/useDialog';
import { clickable } from '../../utils/a11y';


function SigninModal() {


  const { openModal, closeModal, updateObj, setUpdateObj } = useContext(ModalContext);
  // const user = useSelector((state) => state.session.user);
  const dispatch = useDispatch();
  const history = useHistory();
  const formRef = useRef(null);
  // WCAG 2.1.1 / 2.1.2 / 2.4.3 — Escape, focus trap, focus restore.
  useDialog(formRef, closeModal);
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [signInErrors, setSignInErrors] = useState({});

  const [disabledButton, setDisabledButton] = useState(false);
  const [buttonClass, setButtonClass] = useState('signin-div-button button button2 ');
  const [buttonText, setButtonText] = useState('Sign In');
  const [formError, setFormError] = useState('');


  const handleForgotPassword = () => {
    closeModal();
    history.push('/forgotPassword');
  };

  const handleSignUp = () => {
    closeModal();
    openModal('signup');
  };

  useEffect(() => {
    const errors = {};
    const loginErrors = {};

    if (!credential.length) errors['credential'] = 'Please enter a username';
    if (!password.length) errors['password'] = 'Please enter a password';

    if (credential.length < 4) {
      errors['credential'] = 'Please enter a username';
      loginErrors['credential'] = 'Username must be at least 4 characters';
    }
    if (password.length < 6) {
      errors['password'] = 'Please enter a password';
      loginErrors['password'] = 'Password must be at least 6 characters';
    }

    setValidationErrors(errors);
    setSignInErrors(loginErrors);
  }, [credential, password]);

  
  useEffect(() => {
    if (Object.keys(signInErrors).length > 0) {
      setButtonClass('signin-div-button disabled disabled2');
    } else {
      setButtonClass('signin-div-button button button2');
    }
  }, [signInErrors]);



  const handleSubmit = async (e) => {

    e.preventDefault();
    let credentials = {email:credential, password}
    try {
      const  response = await dispatch(
        sessionActions.signin(credentials)
      );

      if (response.status === 200) {
        setFormError('');
        setUpdateObj(null)
        closeModal()
        history.push('/home')

      };
    } catch (error) {
      console.error(error);
      // WCAG 3.3.1 (Error Identification): the only failure signal used to be
      // the submit button's label flipping to "Invalid", which is not an error
      // message and is not reliably announced. State it in text instead.
      setFormError('We could not sign you in. Check the email and password and try again.');
      setDisabledButton(true);
      setButtonClass('signin-div-button disabled disabled2');
      setButtonText('Invalid');
      setTimeout(() => {
        setDisabledButton(false);
        setButtonClass('signin-div-button button button2');
        setButtonText('Sign In');
      }, 3000);
    }
  };


  const demoUser = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const response = await dispatch(
        sessionActions.signin({ email:'demo@dcrader.dev', password:'demouser' })
      );
      if (response.status===200) {
        setUpdateObj(null)
        closeModal()
        history.push('/home')
        return;
      }
      setFormError('The demo account is unavailable right now. Please try again.');
    } catch (error) {
      // This is the primary call to action, and it previously failed silently:
      // no catch, so a rejected sign-in left the modal sitting there.
      console.error(error);
      setFormError('The demo account is unavailable right now. Please try again.');
    }
  };
  
  useEffect(() => {
    if(updateObj !== 'noUser'){
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        closeModal();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }
  }, [updateObj]);


  return (
    <div
      className="signin-form-page-container"
      ref={formRef}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div className="signin-header-container flexcenter">
        <div className="signin-header header-text">Welcome back.</div>
      </div>
      <div className="signin-close-button" aria-label="Close" {...clickable(closeModal)}>
      <i className="fa-solid fa-x"></i>
      </div>

      <button
        type="button"
        onClick={demoUser}
        className="signin-demo-button"
      >
        Try the Demo →
      </button>
      <div className="signin-demo-hint">
        One click, no signup. Logs you in as <b>Demo User</b>.
      </div>
      <div className="signin-divider"><span>or sign in</span></div>

      {/* WCAG 4.1.3 (Status Messages): announced without moving focus. */}
      <p className="signin-form-error" role="alert" aria-live="assertive">
        {formError}
      </p>

      <form onSubmit={handleSubmit} className="signin-div">
        <label className="user">
          Email
          <input
            className="userField"
            type="text"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            required
            placeholder={validationErrors['credential'] || ''}
          />
        </label>
        <label className="pass">
          Password
          <input
            className="passwordField"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={validationErrors['password'] || ''}
          />
        </label>
        <button
          type="submit"
          className={buttonClass}
          disabled={Object.keys(signInErrors).length > 0 || disabledButton}
        >
          {buttonText}
        </button>
      </form>
      <div className="alt-links">


        <div className='signin-no-account-container flexcenter'>
          <div className='flexcenter memo-text'>
            No account?<div {...clickable(handleSignUp)} className='create-one'>Create One</div>  
          </div>
          
        </div>



        <div className='signin-forgot-account-container memo-text'>

          <div>Forgot email or trouble signing in?</div>
          <div className="signin-forgot-password-link link" {...clickable(handleForgotPassword)}>
            Get help.
          </div>
          
        </div>

    




      </div>
    </div>
  );
}

export default SigninModal;
