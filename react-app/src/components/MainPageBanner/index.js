import React from 'react'
import './MainPageBanner.css'
import MmmComponent from '../MmmComponent';


const MainPageBanner = () => {
  return (
    <div className='main-page-banner-container'>
      <div className='content-container'>
        {/* WCAG 1.3.1: the landing page had no h1 at all — this was a div. */}
        <h1 className='stay-curious header-text'>Stay curious.</h1>
        <div className='discover-stories memo-text'>Discover stories, thinking, and expertise from writers on any topic.</div>
        <div className='start-reading button memo-text'>Start reading</div>
      </div>
      <div className='mmm-container-container'>
        <MmmComponent/>
      </div>
    
    </div>
  )
}

export default MainPageBanner