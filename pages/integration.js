import React from 'react'
import Frame from '../components/Frame'
import withData from '../lib/withData'

import Crowdfunding from '../components/Crowdfunding'
import Pledges from '../components/Pledges'
import Me from '../components/Auth/Me'

export default withData(({session, isLoggedIn}) => (
  <Frame sidebar={false}>
    <section>
      <Me />
      <Crowdfunding />
      <Pledges />
    </section>
  </Frame>
))
