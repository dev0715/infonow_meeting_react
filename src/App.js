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
        <Route path="/:token/:meetingId/:lang?" >
          <VideoCall />
        </Route>
      </Switch>
    </Router >
  )

}

export default App;
