import React from 'react'
import {
  BrowserRouter as Router,
  Switch,
  Route
} from "react-router-dom";

import { VideoCall } from "./components/video-call"

function App() {

  return (
    <Router>
      <Switch>
        <Route path="/:meetingId/:token/:lang?" >
          <VideoCall />
        </Route>
      </Switch>
    </Router >
  )

}

export default App;
